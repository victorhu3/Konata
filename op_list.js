let Op = require("./op").Op; // eslint-disable-line
let zlib = require("zlib"); 

// 圧縮して持つページのサイズ
const PAGE_SIZE_BITS = 8;
const PAGE_SIZE = 1 << PAGE_SIZE_BITS;

// 非圧縮で持つキャッシュの間隔．
// CACHE_RESOLUTION命令ごとに1つ，非圧縮で持つ
const CACHE_RESOLUTION = 32;

// 圧縮を開始するまでのマージン
const COMPRESS_START_MARGIN = 16;

// 展開済みページの最大数
const MAX_DECOMPRESSED_PAGES = 128;


function idToPageIndex(id){
    return id >> PAGE_SIZE_BITS;
}
function pageIndexToID(pageIndex){
    return pageIndex << PAGE_SIZE_BITS;
}

class OpListPage {
    constructor(headID){

        this.headID_ = headID;
        
        /** @type {Op[]} */
        this.opList_ = [];

        /** @type {Buffer} */
        this.compressedData_ = null;
        this.isCompressed_ = false;

    }

    getOp(id) {
        let disp = id - this.headID_;
        if (disp < 0 || disp >= PAGE_SIZE) {
            console.log(`Out of range id:${id} head:${this.headID_}`);
            return null;
        }
        else{
            if (this.isCompressed_) {
                this.decompress();
            }
            return this.opList_[disp];
        }
    }

    setOp(id, op) {
        let disp = id - this.headID_;
        if (disp < 0 || disp >= PAGE_SIZE) {
            console.log(`Out of range id:${id} head:${this.headID_}`);
        }
        else{
            this.opList_[disp] = op;
        }
    }

    compress(){
        if (!this.isCompressed_) {
            let json = JSON.stringify(this.opList_);
            //this.compressedData_ = zlib.deflateSync(json);
            this.compressedData_ = zlib.gzipSync(json);
            this.opList_ = [];
            this.isCompressed_ = true;
        }
    }

    decompress(){
        if (this.isCompressed_) {
            //let json = zlib.inflateSync(this.compressedData_);
            let json = zlib.gunzipSync(this.compressedData_).toString();
            this.opList_ = JSON.parse(json);
            //this.compressedData_ = null;
            this.isCompressed_ = false;
            /*
            zlib.gunzip(this.compressedData_, (error, result) => {
                let json = result.toString();
                this.opList_ = JSON.parse(json);
                this.compressedData_ = null;
            });
            this.opList_ = [];
            for (let i = 0; i < PAGE_SIZE; i++) {
                this.opList_[i] = null;
            }
            this.isCompressed_ = false;
            */
        }
    }

    purgeDecompressedData(){
        if (!this.compressedData_) {
            this.compress();
        }
        this.opList_ = [];
        this.isCompressed_ = true;
    }

    get isCompressed(){
        return this.isCompressed_;
    }
}

class OpList {
    constructor(){
        // op 情報
        /** @type {Op[]} */
        this.opList_ = [];

        /** @type {number[]} */
        this.retiredOpID_List_ = [];

        /** @type {OpListPage[]} */
        this.opPages_ = [];

        // 最後にパースが完了した ID
        this.parsedLastID_ = -1;
        this.parsedLastRID_ = -1;

        this.parsingLength_ = 0;

        /** @type {Object<number, Op>} */
        this.cache_ = {};

        // FIFO 置き換えで非圧縮ページを管理
        this.decompressedList_ = [];
    }

    close(){
        this.opList = [];
        this.opPages_ = [];
        this.retiredOpID_List_ = [];
        this.parsedLastID_ = -1;
        this.parsedLastRID_ = -1;
    }

    /** 
     * @param {number} id
     * @param {Op} op
     */
    setOp(id, op){
        let pageIndex = idToPageIndex(id);
        if (!(pageIndex in this.opPages_)) {
            let pageHead = pageIndexToID(pageIndex);
            this.opPages_[pageIndex] = new OpListPage(pageHead);
        }
        this.opPages_[pageIndex].setOp(id, op);

        if (this.parsingLength_ <= id) {
            this.parsingLength_ = id + 1;
        }
        //this.opList_[id] = op;
    }

    /**
     * @param {number} id 
     * @param {number} resolutionLevel 
     */
    getParsedOp(id, resolutionLevel=0){
        resolutionLevel = Math.floor(resolutionLevel);
        if (resolutionLevel >= 1) {
            id -= id & ((2 << resolutionLevel) - 1);
        }
        if (id <= this.parsedLastID_){
            if (id in this.cache_) {
                return this.cache_[id];
            }
            return this.getParsingOp(id);
        }
        else{
            return null;
        }
    }
    
    getParsingOp(id){
        if (0 <= id && id < this.parsingLength_) {
            //return this.opList_[id];
            let pageIndex = idToPageIndex(id);
            let page = this.opPages_[pageIndex];

            if (page.isCompressed) {
                this.decompressedList_.push(pageIndex);
                if (this.decompressedList_.length >= MAX_DECOMPRESSED_PAGES) {
                    let compress = this.decompressedList_.shift();
                    this.opPages_[compress].purgeDecompressedData();
                }
            }

            return page.getOp(id);
        }
        else {
            return null;
        }
    }

    /**
     * @param {number} rid 
     * @param {number} resolutionLevel 
     */
    getParsedOpFromRID(rid, resolutionLevel){
        if (rid > this.parsedLastRID_){
            return null;
        }
        else{
            let id = this.retiredOpID_List_[rid];
            resolutionLevel = Math.floor(resolutionLevel);
            if (resolutionLevel >= 1) {
                id -= id & ((2 << resolutionLevel) - 1);
            }
            return this.getParsedOp(id);
        }
    }

    /** 
     * @param {number} rid
     * @param {Op} op
     * */
    setParsedRetiredOp(rid, op){
        this.retiredOpID_List_[rid] = op.id;
        if (this.parsedLastRID_ < op.rid) {
            this.parsedLastRID_ = op.rid;
        }
    }

    setParsedLastID(id){
        this.parsedLastID_ = id;
        
        let pageIndex = idToPageIndex(id - PAGE_SIZE * COMPRESS_START_MARGIN);
        if (pageIndex >= 0) {
            // Add an op to the cache
            if (!this.opPages_[pageIndex].isCompressed) {
                let head = pageIndexToID(pageIndex);
                for (let i = 0; i < PAGE_SIZE; i += CACHE_RESOLUTION) {
                    let op = this.getParsedOp(head + i);
                    // 一回 JSON にして戻すとかなり容量が減るため
                    op = JSON.parse(JSON.stringify(op));
                    this.cache_[head + i] = op;
                }
            }
            this.opPages_[pageIndex].compress();
        }
    }

    // 現在保持しているリストの長さ
    get parsingLength(){
        return this.parsingLength_;
    }

    get parsedLastID(){
        return this.parsedLastID_;
    }

    get parsedLastRID(){
        return this.parsedLastRID_;
    }
}

module.exports.OpList = OpList;
