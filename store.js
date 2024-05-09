// アプリケーションの状態を保持する store
// store の更新は必ず ACTION による trigger 経由で行う
// 参照は自由に行って良い
// store は ACTION による更新が行われると CHANGE による通知を行う

// ACTION は store の変更を行う
// CHANGE の数字とかぶってはいけない
// view -> store 
const ACTION = {
    APP_QUIT: 0,
    APP_INITIALIZED: 1, // 初期化完了通知

    DIALOG_FILE_OPEN: 10,
    DIALOG_MODAL_MESSAGE: 11,
    DIALOG_MODAL_ERROR: 12,
    
    COMMAND_PALETTE_OPEN: 13,   // コマンドパレットのオープン
    COMMAND_PALETTE_CLOSE: 14,  // コマンドパレットのクローズ
    COMMAND_PALETTE_EXECUTE: 15,    // 引数で受け取った文字列を実行

    FILE_OPEN: 20,
    FILE_RELOAD: 21,
    FILE_CHECK_RELOAD: 22,
    FILE_SHOW_STATS: 23,
    FILE_CLOSE_STATS: 24,
    FILE_SHOW_SETTINGS: 25,
    FILE_CLOSE_SETTINGS: 26,

    TAB_CLOSE: 32,
    TAB_ACTIVATE: 33,
    TAB_MOVE: 34,

    SHEET_RESIZE: 40,           // シートサイズの変更
    SHEET_SHOW_DEV_TOOL: 41,    // 開発者ツールの表示切り替え
    PANE_SPLITTER_MOVE: 50,     // スプリッタ位置の変更

    KONATA_CHANGE_COLOR_SCHEME: 60,     // カラースキームの変更
    KONATA_TRANSPARENT: 61,             // 透過モードの設定
    KONATA_EMPHASIZE_IN_TRANSPARENT: 62, // 透過モード時にアルファ値を下げる
    KONATA_SYNC_SCROLL: 63,             // 同期スクロール
    KONATA_CHANGE_UI_COLOR_THEME: 64,   // UI のカラーテーマの変更
    KONATA_CHANGE_SETTINGS: 65,         // 設定の変更

    KONATA_ZOOM: 73,        // 拡大/縮小

    KONATA_ADJUST_POSITION: 74,  // 位置自動調整
    
    KONATA_MOVE_WHEEL_VERTICAL: 75,  // ホイールによるスクロール（垂直）
    KONATA_MOVE_WHEEL_HORIZONTAL: 76,  // ホイールによるスクロール（水平）
    
    KONATA_MOVE_PIXEL_DIFF: 77,     // 位置移動，引数はピクセル相対値
    KONATA_MOVE_LOGICAL_POS: 78,    // 位置移動，引数は論理座標（サイクル数，命令ID）
    KONATA_MOVE_LABEL_CLICK: 79,    // ラベルペーンのクリック時の移動

    KONATA_SET_DEP_ARROW_TYPE: 88,  // 依存関係の矢印のタイプの設定
    KONATA_SPLIT_LANES: 89,         // レーンを分割して表示するか
    KONATA_FIX_OP_HEIGHT: 90,       // レーン分割時に高さを一定にするかどうか
    KONATA_HIDE_FLUSHED_OPS: 91,         // フラッシュされた命令を隠すかどうか

    KONATA_FIND_STRING: 92,         // Find a specified string
    KONATA_FIND_NEXT_STRING: 93,    // Find a next specified string 
    KONATA_FIND_PREV_STRING: 94,    // Find a previous specified string
    KONATA_FIND_HIDE_RESULT: 95,    // Hide found result
    
    KONATA_GO_TO_BOOKMARK: 96,      // Go to a specified bookmark
    KONATA_SET_BOOKMARK: 97,        // Set a bookmark
    KONATA_ZOOM_H: 98,        // 拡大/縮小

    // MUST NOT OVERLAP NUMBERS IN CHANGE
};

// CHANGE は store で行われた変更の通知に使う
// ACTION の数字とかぶってはいけない
// store -> view
const CHANGE = {
    TAB_OPEN: 100,
    TAB_UPDATE: 101,    // タブ切り替え時の更新

    PANE_SIZE_UPDATE: 102,
    PANE_CONTENT_UPDATE: 103,   // ペーンの中身の更新

    DIALOG_FILE_OPEN: 110,
    DIALOG_MODAL_MESSAGE: 111,
    DIALOG_MODAL_ERROR: 112,
    DIALOG_CHECK_RELOAD: 113,
    DIALOG_SHOW_STATS: 114,
    DIALOG_SHOW_SETTINGS: 115,
    
    COMMAND_PALETTE_OPEN: 116,
    COMMAND_PALETTE_CLOSE: 117,

    MENU_UPDATE: 120,   // メニュー内容の更新

    SHEET_UPDATE_DEV_TOOL: 190,    // 開発者ツールの表示

    PROGRESS_BAR_START:  200,    // プレグレスバーの更新開始
    PROGRESS_BAR_UPDATE: 201,    // 読み込みのプレグレスバーの更新
    PROGRESS_BAR_FINISH: 202,    // ファイル読み込み終了

    WINDOW_CSS_UPDATE: 300 // テーマ変更により，CSS が変更された
};


class Tab{
    /** 
     * @param {string} fileName
     * @param {Konata} konata
     * @param {KonataRenderer} renderer
     * @param {Config} config
     * */
    constructor(id, fileName, konata, renderer, config){
        let fs = require("fs");
        let KonataRenderer = require("./konata_renderer").KonataRenderer; // eslint-disable-line
        let Konata = require("./konata").Konata; // eslint-disable-line
        let Op = require("./op").Op;   // eslint-disable-line
        let Config = require("./config").Config;   // eslint-disable-line

        // ファイル更新時間
        let mtime = fs.statSync(fileName).mtime;

        this.id = id; 
        this.fileName = fileName;
        this.lastFileCheckedTime = mtime;
        this.konata = konata;
        this.renderer = renderer;
        this.splitterPos = config.splitterPosition;
        this.transparent = false; // 透明化の有効無効
        this.hideFlushedOps = false;  // フラッシュされた命令を隠すか
        this.emphasize_in_transparent = false; // 透明化の際に表示を強調するかどうか
        this.colorScheme = config.colorScheme;  // カラースキーム
        this.syncScroll =  false;  // スクロールを同期 
        
        this.scrollEndPos =  [0, 0];   // スクロール終了位置
        this.curScrollPos =  [0, 0];   // 現在のスクロール位置

        this.FindContext = class{
            constructor(){
                this.targetPattern = "";  // 検索中の文字の正規表現パターン
                this.foundStr = "";       // ヒットした文字列全体
                this.found = false;       // ヒットしたかどうか
                this.visibility = false;  // 検索結果を表示するかどうか
                /** @type {Op} */
                this.op = null; // 見つかった op

                // 検索の ID．新しい検索を行うたびにインクリメントされる
                // 現在実行中の検索は，ID が変化した場合はキャンセルされる
                this.findID = 0;
                this.flushed = false;   // フラッシュされたかどうか
            }
        };
        this.findContext = new this.FindContext;
    }
}

/**
 * @mixes Observable
 */
class Store{
    constructor(){
        
        // この書式じゃないと IntelliSense が効かない
        let remote = require("@electron/remote");
        let fs = require("fs");

        let KonataRenderer = require("./konata_renderer");
        let Konata = require("./konata");
        let Config = require("./config");
        let Op = require("./op").Op;   // eslint-disable-line


        // Tab
        this.config = new Config.Config();

        /** @type {Object.<number,Tab>} */
        this.tabs = {}; // id -> tab

        this.nextOpenedTabID = 0; // 次にオープンされるタブの ID 
        this.activeTabID = 0;     // 現在アクティブなタブの ID 
        this.prevTabID = -1;      // 前回アクティブだったタブの ID 

        /** @type {Tab} */
        this.activeTab = null;  // 現在アクティブなタブ

        /** @type {Tab} */
        this.prevTab = null;       // 前回アクティブだったタブ

        // 開発者ツールの表示切り替え
        this.showDevTool = false;

        // レーン表示関係
        this.splitLanes = false;
        this.fixOpHeight = false;


        // ズームのアニメーション
        this.zoom = {
            inAnimation: false,
            diff: 0.0,  
            speed: 1.0,
            endLevel: 0.0,
            curLevel: 0.0,
            basePoint: [0, 0],
            direction: false,
            timerID: null,
            compensatePos: true // 位置補正を行うか
        };
        let ZOOM_ANIMATION_PERIOD = 80;    // mille seconds

        // スクロールのアニメーション
        this.inScrollAnimation = false;
        this.scrollAnimationDiff = [0, 0];
        this.scrollAnimationDirection = [false, false];
        this.scrollAnimationID = null;
        this.scrollSpeed = 1.0;
        let SCROLL_ANIMATION_PERIOD = 100;  // ミリ秒

        // Any dialog is opened or not
        this.isCommandPaletteOpened = false;
        this.isStatsDialogOpened = false;
        this.isSettingsDialogOpened = false;
        this.isAnyDialogOpened = () => {
            return this.isCommandPaletteOpened || this.isStatsDialogOpened || this.isSettingsDialogOpened;
        };


        // Dummy functions for a type-script checker
        // The actual handlers are set in riot.observable.
        this.on = (ev, func) => { return [ev, func]; };
        this.trigger = (ev, ...args) => { return [ev, args]; };
        /* globals riot */
        riot.observable(this);

        let self = this;

        // ダイアログ
        // 基本的に中継してるだけ
        self.on(ACTION.DIALOG_FILE_OPEN, function(){
            self.trigger(CHANGE.DIALOG_FILE_OPEN);
        });
        self.on(ACTION.DIALOG_MODAL_MESSAGE, function(msg){
            self.trigger(CHANGE.DIALOG_MODAL_MESSAGE, msg);
        });
        self.on(ACTION.DIALOG_MODAL_ERROR, function(msg){
            self.trigger(CHANGE.DIALOG_MODAL_ERROR, msg);
        });

        // コマンドパレット
        self.on(ACTION.COMMAND_PALETTE_OPEN, function(command){
            if (!self.isCommandPaletteOpened) { // Avoid overwriting palette contents
                self.isCommandPaletteOpened = true;
                self.trigger(CHANGE.COMMAND_PALETTE_OPEN, command);
            }
        });
        self.on(ACTION.COMMAND_PALETTE_CLOSE, function(){
            self.isCommandPaletteOpened = false;
            self.trigger(CHANGE.COMMAND_PALETTE_CLOSE);
        });
        self.on(ACTION.COMMAND_PALETTE_EXECUTE, function(cmd){
            let accept = false;

            if (cmd.match(/j[\s]+(\d+)/)) { // js #line
                if (self.activeTab) {
                    let id = Number(RegExp.$1);
                    let renderer = self.activeTab.renderer;
                    let pos = renderer.viewPos;
                    let op = renderer.getVisibleOp(id);
                    if (op) {
                        self.startScroll([op.fetchedCycle - pos[0], id - pos[1]]);
                    }
                    accept = true;
                }
            }
            else if (cmd.match(/jr[\s](\d+)/)) { // jr #rid
                if (self.activeTab) {
                    let rid = Number(RegExp.$1);
                    let renderer = self.activeTab.renderer;
                    let pos = renderer.viewPos;
                    let op = renderer.getOpFromRID(rid);
                    let y = renderer.getPosY_FromRID(rid);
                    if (op) {
                        self.startScroll([op.fetchedCycle - pos[0], y - pos[1]]);
                    }
                    accept = true;
                }
            }
            else if (cmd.match(/^f[\s]+(.+)$/)) {   // find #
                if (self.activeTab) {
                    let target = RegExp.$1;
                    self.trigger(ACTION.KONATA_FIND_STRING, target);
                    accept = true;
                }
            }
            else if (cmd.match(/^l[\s]+(.+)$/)) {   // load #
                let target = RegExp.$1;
                self.trigger(ACTION.FILE_OPEN, target);
                accept = true;
            }
            else {
                self.trigger(CHANGE.DIALOG_MODAL_ERROR, `Failed to parse: ${cmd}`);
            }
            if (accept) {
                self.config.commandHistory.unshift(cmd);
                if (self.config.commandHistory.length > self.config.maxCommandHistoryNum) {
                    self.config.commandHistory.pop();
                }
            }
            /*
            else if (cmd.match(/^o[\s]+(.+)$/)) {   // find #
                let target = RegExp.$1;
                self.trigger(ACTION.FILE_OPEN, target);
            }
            */
        });

        // 開発者ツールの表示切り替え
        self.on(ACTION.SHEET_SHOW_DEV_TOOL, function(show){
            self.showDevTool = show;
            self.trigger(CHANGE.SHEET_UPDATE_DEV_TOOL, show);
        });

        // ファイルオープン
        self.on(ACTION.FILE_OPEN, function(fileName){
            // Load a file
            let konata = new Konata.Konata();
            let tabID = self.nextOpenedTabID;
            try {
                self.trigger(CHANGE.PROGRESS_BAR_START, tabID, "load");
                konata.openFile(fileName, 
                    (percent, count) => {  // 更新通知ハンドラ
                        self.trigger(CHANGE.PROGRESS_BAR_UPDATE, percent, tabID, "load");
                        if (count % 10 == 0) {  // 常に再描画すると重いので，10% おきに再描画
                            self.trigger(CHANGE.PANE_CONTENT_UPDATE);
                        }
                    },
                    () => {  // 読み出し終了ハンドラ
                        self.trigger(CHANGE.PROGRESS_BAR_FINISH, tabID, "load");
                        self.trigger(CHANGE.PANE_CONTENT_UPDATE);
                    },
                    (errorMsg) => { // エラーハンドラ
                        self.trigger(CHANGE.DIALOG_MODAL_ERROR, `Failed to load '${fileName}': ${errorMsg}`);
                        self.trigger(ACTION.TAB_CLOSE, tabID);
                    }
                );
            }
            catch (e) {
                konata.close();
                self.trigger(CHANGE.DIALOG_MODAL_ERROR, `Failed to load '${fileName}': ${e}`);
                return;
            }

            self.config.onLoadFile(fileName);

            let renderer = new KonataRenderer.KonataRenderer();
            renderer.init(konata, self.config);

            let tab = new Tab(self.nextOpenedTabID, fileName, konata, renderer, self.config);

            self.tabs[self.nextOpenedTabID] = tab;
            self.activeTabID = self.nextOpenedTabID;
            self.activeTab = self.tabs[self.activeTabID];
            self.nextOpenedTabID++;
        
            self.trigger(CHANGE.TAB_OPEN, tab);
            self.trigger(CHANGE.TAB_UPDATE, tab);
            self.trigger(CHANGE.PANE_SIZE_UPDATE);
            self.trigger(CHANGE.PANE_CONTENT_UPDATE);
            self.trigger(CHANGE.MENU_UPDATE);
        });

        // ファイルリロード
        self.on(ACTION.FILE_RELOAD, function(){
            let konata = self.activeTab.konata;
            konata.reload();
            self.trigger(CHANGE.PROGRESS_BAR_START, self.activeTab.id, "load");
            self.trigger(CHANGE.PANE_CONTENT_UPDATE);
        });

        // リロードのチェック要求
        self.on(ACTION.FILE_CHECK_RELOAD, function(){
            if (!self.activeTab) {
                return;
            }
            // ファイル更新時間
            let fileName = self.activeTab.fileName;
            let mtime = fs.statSync(fileName).mtime;
            if (self.activeTab.lastFileCheckedTime < mtime){
                // リロードチェックのダイアログを起動
                self.trigger(CHANGE.DIALOG_CHECK_RELOAD, fileName);
            }
            self.activeTab.lastFileCheckedTime = mtime;
        });

        // Show statistics
        self.on(ACTION.FILE_SHOW_STATS, function(){
            if (!self.activeTab) {
                return;
            }
            let tab = self.activeTab;
            let tabID = tab.id;
            self.trigger(CHANGE.PROGRESS_BAR_START, tab.id, "stats");
            tab.konata.stats(
                (percent, count) => {  // 更新通知ハンドラ
                    self.trigger(CHANGE.PROGRESS_BAR_UPDATE, percent, tabID, "stats");
                    if (count % 10 == 0) {  // 常に再描画すると重いので，10% おきに再描画
                        self.trigger(CHANGE.PANE_CONTENT_UPDATE);
                    }
                },
                (stats) => {  // 読み出し終了ハンドラ
                    self.trigger(CHANGE.PROGRESS_BAR_FINISH, tabID, "stats");
                    self.trigger(CHANGE.PANE_CONTENT_UPDATE);

                    self.isStatsDialogOpened = true;
                    self.trigger(CHANGE.DIALOG_SHOW_STATS, stats);
                },
            );
        });

        self.on(ACTION.FILE_CLOSE_STATS, function(){
            self.isStatsDialogOpened = false;
        });

        // Show statistics
        self.on(ACTION.FILE_SHOW_SETTINGS, function(){
            self.isSettingsDialogOpened = true;
            self.trigger(CHANGE.DIALOG_SHOW_SETTINGS);
        });

        self.on(ACTION.FILE_CLOSE_SETTINGS, function(){
            self.isSettingsDialogOpened = false;
        });

        // アクティブなタブの変更
        self.on(ACTION.TAB_ACTIVATE, function(id){
            if (!(id in self.tabs)) {
                console.log(`ACTION.TAB_ACTIVATE: invalid id: ${id}`);
                return;
            }

            self.prevTabID = self.activeTabID;
            self.prevTab = self.activeTab;

            self.activeTabID = id;
            self.activeTab = self.tabs[self.activeTabID];

            self.trigger(CHANGE.TAB_UPDATE);
            self.trigger(CHANGE.PANE_CONTENT_UPDATE);
            self.trigger(CHANGE.MENU_UPDATE);
        });

        // タブ移動
        self.on(ACTION.TAB_MOVE, function(next){
            let ids = Object.keys(self.tabs).sort();
            for (let i = 0; i < ids.length; i++) {
                if (self.activeTab.id == ids[i]) {
                    let to = next ? ids[(i+1)%ids.length] : ids[(i+ids.length-1)%ids.length];
                    self.trigger(ACTION.TAB_ACTIVATE, to);
                    break;
                }
            }
        });

        // タブを閉じる
        self.on(ACTION.TAB_CLOSE, function(id){
            if (!(id in self.tabs)) {
                console.log(`ACTION.TAB_CLOSE: invalid id: ${id}`);
                return;
            }

            self.tabs[id].konata.close();   // 非同期読み込みを明示的に終わらせる
            delete self.tabs[id];
            self.activeTab = null;

            for(let newID in self.tabs){
                self.activeTabID = Number(newID);
                self.activeTab = self.tabs[newID];
                break;
            }
            if (!self.activeTab) {
                self.activeTabID = -1;
            }
            self.trigger(CHANGE.TAB_UPDATE);
            self.trigger(CHANGE.PANE_CONTENT_UPDATE);
            self.trigger(CHANGE.MENU_UPDATE);
            self.trigger(CHANGE.PROGRESS_BAR_FINISH, id, "load");   // 読み込み中なら，更新を終了
        });

        // ウィンドウのサイズ変更
        self.on(ACTION.SHEET_RESIZE, function(bounds){
            if ("x" in bounds && "y" in bounds && 
                "width" in bounds && "height" in bounds
            ) {
                self.config.windowBounds = bounds;
                //console.log(bounds);
            }
            self.trigger(CHANGE.PANE_SIZE_UPDATE);
            self.trigger(CHANGE.PANE_CONTENT_UPDATE);
        });

        // スプリッタの位置変更
        self.on(ACTION.PANE_SPLITTER_MOVE, function(position){
            if (!self.activeTab) {
                return;
            }
            let sync = self.activeTab.syncScroll;   // 同期
            for (let id in self.tabs) {
                let tab = self.tabs[id];
                if (sync || self.activeTab.id == tab.id) {
                    tab.splitterPos = position;
                }
            }
            self.config.splitterPosition = position;
            self.trigger(CHANGE.PANE_SIZE_UPDATE);
            self.trigger(CHANGE.PANE_CONTENT_UPDATE);
        });

        // アプリケーション終了
        self.on(ACTION.APP_QUIT, function(){
            // store.config が生きている間 = ウィンドウの生存期間内に処理をしないといけない
            // app.quit ではウィンドウの close イベントが呼ばれないため，手動で保存する
            self.config.save(); 
            remote.app.quit();
        });

        // アプリケーション初期化完了
        self.on(ACTION.APP_INITIALIZED, function(){
            // Load files passed by command line arguments
            let argv = remote.process.argv;
            let start = 1;
            console.log(argv[0]);
            if (argv[0].match(/[/\\]electron/)) {
                start = 2;  // Command line argument starts at the second when launched from electron.
            }
            for (let i = start; i < argv.length; i++) {
                if (!argv[i].match(/^[-]/) && argv[i] != ".") {
                    self.trigger(ACTION.FILE_OPEN, argv[i]);
                }
            }
        });

        // ズームのスタート
        this.startZoom = function(zoomLevelDiff, offsetX, offsetY, speed=1.0, compensatePos=false){
            if (self.zoom.inAnimation) {
                self.finishZoom();
            }
            // 拡大 or 縮小
            self.zoom.direction = zoomLevelDiff > 0;
            self.zoom.diff = zoomLevelDiff;
            self.zoom.curLevel = self.activeTab.renderer.zoomLevel;
            self.zoom.endLevel = 
                self.zoom.curLevel + zoomLevelDiff;
            self.zoom.speed = speed;
            self.zoom.basePoint = [offsetX, offsetY];
            self.zoom.inAnimation = true;
            self.zoom.timerID = setInterval(self.animateZoom, 16);
            self.zoom.compensatePos = compensatePos;
        };

        // ズームアニメーション中は，一定時間毎に呼び出される
        this.animateZoom = function(){
            if (!self.zoom.inAnimation) {
                return;
            }

            let frames = ZOOM_ANIMATION_PERIOD / 16 / self.zoom.speed;
            self.zoom.curLevel += self.zoom.diff / frames;
            
            self.zoomAbs(
                self.zoom.curLevel, 
                self.zoom.basePoint[0], 
                self.zoom.basePoint[1],
                self.zoom.compensatePos
            );

            if ((self.zoom.direction && self.zoom.curLevel >= self.zoom.endLevel) ||
                (!self.zoom.direction && self.zoom.curLevel <= self.zoom.endLevel)
            ){
                self.finishZoom();
            }
        };

        // 拡大/縮小
        // zoomLevel は zoom level の値
        // posX, posY はズームの中心点
        this.zoomAbs = function(zoomLevel, posX, posY, compensatePos){
            if (!self.activeTab) {
                return;
            }
            self.scrollTabs(function(tab){
                tab.renderer.zoomAbs(zoomLevel, posX, posY, compensatePos);
            });
            self.trigger(CHANGE.PANE_CONTENT_UPDATE);
        };

        // ズームの強制終了
        this.finishZoom= function(){
            self.zoom.inAnimation = false;
            clearInterval(self.zoom.timerID);
            self.scrollTabs(function(tab){
                tab.renderer.zoomAbs(
                    self.zoom.endLevel, 
                    self.zoom.basePoint[0], 
                    self.zoom.basePoint[1],
                    self.zoom.compensatePos
                );
            });
            self.trigger(CHANGE.PANE_CONTENT_UPDATE);
        };

        // 拡大/縮小
        // zoomLevelDiff は zoom level の差分
        // posX, posY はズームの中心点
        self.on(ACTION.KONATA_ZOOM, function(zoomLevelDiff, posX, posY, speed=1.0){
            if (!self.activeTab){
                return;
            }
            self.startZoom(zoomLevelDiff / self.config.drawZoomFactor, posX, posY, speed, true);
        });

        // スクロール同期対象のタブに，渡された関数を適用する
        this.scrollTabs = function(f){
            let sync = self.activeTab.syncScroll;   // 同期
            for (let id in self.tabs) {
                let tab = self.tabs[id];
                if (sync || self.activeTab.id == tab.id) {
                    f(tab);
                }
            }
        };

        // スクロールのアニメーションのスタート
        this.startScroll = function(scrollDiff, speed=1.0){
            if (self.inScrollAnimation) {
                self.finishScroll();
            }

            self.scrollAnimationDiff = scrollDiff;
            self.scrollAnimationDirection = [scrollDiff[0] > 0, scrollDiff[1] > 0];
            self.scrollTabs(function(tab){
                tab.curScrollPos = tab.renderer.viewPos;
                tab.scrollEndPos = [
                    tab.curScrollPos[0] + scrollDiff[0],
                    tab.curScrollPos[1] + scrollDiff[1]
                ];
            });
            self.inScrollAnimation = true;
            self.scrollAnimationID = setInterval(self.animateScroll, 16);
            self.scrollSpeed = speed;
        };

        // アニメーション中は，一定時間毎に呼び出される
        this.animateScroll = function(){
            if (!self.inScrollAnimation) {
                return;
            }

            let diff = self.scrollAnimationDiff;
            let dir = self.scrollAnimationDirection;
            let frames = SCROLL_ANIMATION_PERIOD / 16 / self.scrollSpeed;

            self.scrollTabs(function(tab){
                tab.curScrollPos[0] += diff[0] / frames;
                tab.curScrollPos[1] += diff[1] / frames;
                tab.renderer.moveLogicalPos(tab.curScrollPos);
            });

            if (((dir[0] && self.activeTab.curScrollPos[0] >= self.activeTab.scrollEndPos[0]) ||
                (!dir[0] && self.activeTab.curScrollPos[0] <= self.activeTab.scrollEndPos[0])) &&
                ((dir[1] && self.activeTab.curScrollPos[1] >= self.activeTab.scrollEndPos[1]) ||
                (!dir[1] && self.activeTab.curScrollPos[1] <= self.activeTab.scrollEndPos[1]))
            ){
                self.inScrollAnimation = false;
                clearInterval(self.scrollAnimationID);
                self.scrollTabs(function(tab){
                    tab.renderer.moveLogicalPos(tab.scrollEndPos);
                });
            }
            self.trigger(CHANGE.PANE_CONTENT_UPDATE);
        };

        // スクロールの強制終了
        this.finishScroll = function(){
            self.inScrollAnimation = false;
            clearInterval(self.scrollAnimationID);
            
            self.scrollTabs(function(tab){
                tab.renderer.moveLogicalPos(tab.scrollEndPos);
            });
            self.trigger(CHANGE.PANE_CONTENT_UPDATE);
        };

        // その時のパイプラインの左上がくるように移動
        this.on(ACTION.KONATA_ADJUST_POSITION, function(){
            if (!self.activeTab) {
                return;
            }
            if (self.inScrollAnimation) {
                self.finishScroll();
            }
            if (self.zoom.inAnimation) {
                self.finishZoom();
            }

            let activeRenderer = self.activeTab.renderer;
            let op = null;
            if (activeRenderer.viewPos[1] < 0) {
                op = activeRenderer.getOpFromID(0);
            }
            else if (activeRenderer.viewPos[1] > activeRenderer.getVisibleBottom()) {
                let bottom = activeRenderer.getVisibleBottom() - 30;
                op = self.activeTab.hideFlushedOps ? activeRenderer.getOpFromRID(bottom) : activeRenderer.getOpFromID(bottom);
            }
            else{
                op = activeRenderer.getOpFromPixelPosY(0);
            }
            if (op) {
                let retiredOp = activeRenderer.getOpFromRID(op.rid);
                if (retiredOp) {
                    op = retiredOp;
                }
                let activeY = self.activeTab.hideFlushedOps ? op.rid : op.id;
                activeRenderer.moveLogicalPos([op.fetchedCycle, activeY]);
                
                // 同期が有効の場合，左上の命令の RID が一致するようにスクロールさせる
                let sync = self.activeTab.syncScroll;   
                if (sync) {
                    // Synchronize the splitter positions.
                    // If the splitter positions are different, the left edge of 
                    // each pipeline pane will be different and you will not be 
                    // able to synchronize the panes well, so synchronize the 
                    // splitter positions.
                    self.trigger(ACTION.PANE_SPLITTER_MOVE, self.activeTab.splitterPos);

                    for (let id in self.tabs) {
                        let tab = self.tabs[id];
                        let renderer = tab.renderer;
                        let synchedOp = renderer.getOpFromRID(op.rid);
                        if (synchedOp && self.activeTab.id != tab.id) {
                            let y = tab.hideFlushedOps ? synchedOp.rid : synchedOp.id;
                            renderer.zoomAbs(activeRenderer.zoomLevel, 0, 0, false);
                            renderer.moveLogicalPos([synchedOp.fetchedCycle, y]);
                        }
                    }
                }
                self.trigger(CHANGE.PANE_CONTENT_UPDATE);
            }
        });


        // ホイールによる移動（垂直）
        // delta: delta * 3 / scale だけ上下に移動
        // adjust: 水平方向のスクロール補正を行うかどうか
        self.on(ACTION.KONATA_MOVE_WHEEL_VERTICAL, function(delta, adjust){
            if (!self.activeTab) {
                return;
            }
            if (self.inScrollAnimation) {
                self.finishScroll();
            }
            let renderer = self.activeTab.renderer;
            let scale = renderer.zoomScale;
            let diffY = delta * 3 / scale;
            let diffX = adjust ? renderer.adjustScrollDiffX(diffY) : 0;
            self.startScroll([diffX, diffY]);
        });

        // ホイールによる移動（水平）
        // 引数 delta * 6 / scale だけ左右に移動
        self.on(ACTION.KONATA_MOVE_WHEEL_HORIZONTAL, function(delta){
            if (!self.activeTab) {
                return;
            }
            if (self.inScrollAnimation) {
                self.finishScroll();
            }
            let renderer = self.activeTab.renderer;
            let scale = renderer.zoomScale;
            let diffX = delta * 6 / scale;
            let diffY = 0;
            self.startScroll([diffX, diffY]);
        });


        // 位置移動，引数はピクセル相対値
        self.on(ACTION.KONATA_MOVE_PIXEL_DIFF, function(diff){
            if (!self.activeTab) {
                return;
            }
            self.scrollTabs(function(tab){
                tab.renderer.movePixelDiff(diff);
            });
            self.trigger(CHANGE.PANE_CONTENT_UPDATE);
        });

        // 位置移動，引数は論理座標（サイクル数，命令ID）
        self.on(ACTION.KONATA_MOVE_LOGICAL_POS, function(pos){
            if (!self.activeTab) {
                return;
            }
            self.scrollTabs(function(tab){
                tab.renderer.moveLogicalPos(pos);
            });
            self.trigger(CHANGE.PANE_CONTENT_UPDATE);
        });

        // ラベルクリック時の移動
        // 引数は縦方向のピクセル座標
        // 同期時は，それぞれのタブごとに独立に位置を合わせる
        self.on(ACTION.KONATA_MOVE_LABEL_CLICK, function(offsetY){
            if (!self.activeTab) {
                return;
            }

            self.scrollTabs(function(tab){
                let renderer = tab.renderer;
                let op = renderer.getOpFromPixelPosY(offsetY);
                if (op) {
                    renderer.moveLogicalPos([op.fetchedCycle, renderer.viewPos[1]]);
                }
            });
            self.trigger(CHANGE.PANE_CONTENT_UPDATE);
        });

        // カラースキームの変更
        self.on(ACTION.KONATA_CHANGE_COLOR_SCHEME, function(tabID, scheme){
            if (!(tabID in self.tabs)) {
                return;
            }
            let tab = self.tabs[tabID];
            self.config.colorScheme = scheme;
            tab.colorScheme = scheme;
            tab.renderer.changeColorScheme(scheme);
            self.trigger(CHANGE.PANE_CONTENT_UPDATE);
            self.trigger(CHANGE.MENU_UPDATE);
        });

        // UI のカラーテーマの変更
        self.on(ACTION.KONATA_CHANGE_UI_COLOR_THEME, function(theme){
            self.config.theme = theme;
            for (let tabID in self.tabs) {
                self.tabs[tabID].renderer.loadStyle();
            }
            self.trigger(CHANGE.WINDOW_CSS_UPDATE);
            self.trigger(CHANGE.PANE_CONTENT_UPDATE);
            self.trigger(CHANGE.MENU_UPDATE);
        });

        // Change settings
        self.on(ACTION.KONATA_CHANGE_SETTINGS, function(key, value){
            if (key in self.config.configItems) {
                self.config[key] = value;
            }
            self.trigger(CHANGE.WINDOW_CSS_UPDATE);
            self.trigger(CHANGE.PANE_CONTENT_UPDATE);
            self.trigger(CHANGE.MENU_UPDATE);
        });

        // 依存関係の矢印のタイプを変更
        self.on(ACTION.KONATA_SET_DEP_ARROW_TYPE, function(type){
            self.config.depArrowType = type;
            for (let tabID in self.tabs) {
                self.tabs[tabID].renderer.depArrowType = type;
            }
            self.trigger(CHANGE.PANE_CONTENT_UPDATE);
            self.trigger(CHANGE.MENU_UPDATE);
        });

        // レーンを分割して表示するか
        self.on(ACTION.KONATA_SPLIT_LANES, function(enabled){
            self.splitLanes = enabled;
            for (let tabID in self.tabs) {
                self.tabs[tabID].renderer.splitLanes = enabled;
            }
            self.trigger(CHANGE.PANE_CONTENT_UPDATE);
            self.trigger(CHANGE.MENU_UPDATE);
        });

        // レーン分割時に高さを一定にするかどうか
        self.on(ACTION.KONATA_FIX_OP_HEIGHT, function(enabled){
            self.fixOpHeight = enabled;
            for (let tabID in self.tabs) {
                self.tabs[tabID].renderer.fixOpHeight = enabled;
            }
            self.trigger(CHANGE.PANE_CONTENT_UPDATE);
            self.trigger(CHANGE.MENU_UPDATE);
        });

        // フラッシュされた命令を表示しない
        self.on(ACTION.KONATA_HIDE_FLUSHED_OPS, function(tabID, enable){
            if (!(tabID in self.tabs)) {
                return;
            }
            let tab = self.tabs[tabID];
            let renderer = self.tabs[tabID].renderer;

            // 現在の表示位置を取得
            let orgOp = renderer.getOpFromPixelPosY(0);
            let rid = 0;
            if (orgOp) {
                rid = orgOp.rid;
            }

            tab.hideFlushedOps = enable;
            renderer.hideFlushedOps = enable;

            // 元の命令の RID の位置に移動
            let op = renderer.getOpFromRID(rid);
            if (op) {
                renderer.moveLogicalPos([op.fetchedCycle, enable ? rid : op.id]);
            }

            self.trigger(CHANGE.MENU_UPDATE);
            self.trigger(CHANGE.PANE_CONTENT_UPDATE);
        });

        // パイプラインのペーンを透明化
        self.on(ACTION.KONATA_TRANSPARENT, function(tabID, enable){
            if (!(tabID in self.tabs)) {
                return;
            }
            let tab = self.tabs[tabID];
            tab.transparent = enable;
            self.trigger(CHANGE.TAB_UPDATE);
            self.trigger(CHANGE.PANE_CONTENT_UPDATE);
            self.trigger(CHANGE.MENU_UPDATE);
        });

        // パイプラインのペーンが透明化されている際に，表示を強調する
        self.on(ACTION.KONATA_EMPHASIZE_IN_TRANSPARENT, function(tabID, enable){
            if (!(tabID in self.tabs)) {
                return;
            }
            let tab = self.tabs[tabID];
            tab.emphasize_in_transparent = enable;
            self.trigger(CHANGE.TAB_UPDATE);
            self.trigger(CHANGE.PANE_CONTENT_UPDATE);
            self.trigger(CHANGE.MENU_UPDATE);
        });

        // スクロールの同期化
        self.on(ACTION.KONATA_SYNC_SCROLL, function(tabID, syncedTabID, enable){

            if (!(tabID in self.tabs)) {
                self.trigger(
                    ACTION.DIALOG_MODAL_MESSAGE,
                    `An invalid tab id ${tabID} is specified in ACTION.KONATA_SYNC_SCROLL.`
                );
            }
            let tab = self.tabs[tabID];

            if (enable) {
                if (!(syncedTabID in self.tabs)) {
                    return;
                }
                tab.syncScroll = true;
            }
            else{
                tab.syncScroll = false;
            }

            self.trigger(CHANGE.MENU_UPDATE);
        });

        /** @param {Op} op */ 
        this.makeFindTargetString = function(op) {
            let labelString = 
            `${op.id}: s${op.gid} (t${op.tid}: r${op.rid}) ${op.labelName}\n${op.labelDetail}`;
            for (let laneName in op.lanes) {
                for (let stage of op.lanes[laneName].stages) {
                    if (stage.labels != "") {
                        labelString += "\n" + stage.labels;
                    }
                }
            }
            return labelString;
        };

        // Find a specified string
        /** 
         * @param {string} target 
         * @param {number} basePos 
         * @param {boolean} reverse 
         * @param {function(boolean, boolean): void} resultHandler 
         * */
        this.findString = async function(target, basePos, reverse, resultHandler) {

            //console.log(`Find: ${target}, start from ${basePos}, reverse:${reverse}`);

            let tab = self.activeTab;

            tab.findContext.findID++;
            let findID = tab.findContext.findID;

            let konata = tab.konata;
            let targetPattern = new RegExp(target);

            let SLEEP_PERIOD = 1024*8;
            let prevSleepTime = new Date().getTime();
            let startTime = new Date().getTime();

            let canceled = false;
            let found = false;
            let foundPos = -1;
            let lastOpID = konata.lastID;
            let cur = basePos;

            if (cur < 0 || cur >= lastOpID) cur = 0;  // 開始位置の座標が外の場合
            self.trigger(CHANGE.PROGRESS_BAR_START, tab.id, "search");

            // lastOpID 個の op を cur の次から探す
            for (let i = 0; i <= lastOpID; i++) {
                cur += reverse ? -1 : 1;
                // ラップアラウンド
                if (cur < 0) cur += lastOpID;
                else if (cur > lastOpID) cur = 0;

                // 検索
                let op = konata.getOp(cur);
                if (op && targetPattern.exec(self.makeFindTargetString(op))){
                    found = true; 
                    foundPos = cur; 
                    break; 
                }

                // 一定時間経過ごとに，プログレスバーを更新
                if (i % SLEEP_PERIOD == 0) {
                    let curTime = new Date().getTime();
                    if (prevSleepTime + 100 < curTime){
                        prevSleepTime = curTime;
                        self.trigger(CHANGE.PROGRESS_BAR_UPDATE, i / lastOpID, tab.id, "search");
                        await new Promise(r => setTimeout(r, 17));
                        if (findID != tab.findContext.findID) {
                            // 新しい検索が開始されたので抜ける
                            canceled = true;
                            break;
                        }
                    }
                }
            }
            let elapsedTime = new Date().getTime() - startTime;
            console.log(`Search finished: ${target}@${foundPos}, ${elapsedTime} msec`);
            self.trigger(CHANGE.PROGRESS_BAR_FINISH, tab.id, "search");

            if (!canceled) {
                tab.findContext.found = false;
                if (found) {
                    let op = konata.getOp(foundPos);
                    if (op) {
                        let renderer = tab.renderer;
                        let viewPos = renderer.viewPos;
                        let moveTo = renderer.getPosY_FromOp(op);
    
                        let ctx = tab.findContext;
                        ctx.found = true;
                        ctx.visibility = true;
                        ctx.targetPattern = target;
                        ctx.foundStr = this.makeFindTargetString(op);
                        ctx.op = renderer.getVisibleOp(moveTo);
                        ctx.flushed = op.flush;
    
                        let hOpPos = op.fetchedCycle;//renderer.calcLogicalAddrPos(op);
                        if (hOpPos < viewPos[0] || 
                            hOpPos > viewPos[0] + 800 / renderer.opW_
                        ) { // 表示範囲内になかった場合は，横位置も移動
                            hOpPos = hOpPos + (-100 / renderer.opW_) - viewPos[0];
                        }
                        else{ // 横位置を変えない
                            hOpPos = 0;
                        }
                        let vOpPos = moveTo;
                        if (vOpPos < viewPos[1] || 
                            vOpPos > viewPos[1] + 400 / renderer.opH
                        ) { // 表示範囲内になかった場合は，位置も移動
                            vOpPos = vOpPos + (-100 / renderer.opH) - viewPos[1];
                        }
                        else{ // 位置を変えない
                            vOpPos = 0;
                        }
                        self.startScroll([hOpPos, vOpPos]);
                    }
                    //console.log(`Found: ${target}@${foundPos}`);
                }
            }
            resultHandler(found, canceled);
        };

        self.on(ACTION.KONATA_FIND_STRING, function(target){
            if (!self.activeTab) {
                return;
            }

            // 無効な正規表限をチェック
            try{
                new RegExp(target);
            }
            catch(e){
                self.trigger(CHANGE.DIALOG_MODAL_ERROR, `"${target}" is invalid regular expression. \n${e}`);
                return;
            }

            let findContext = self.activeTab.findContext;
            findContext.targetPattern = target;
            
            let pos = Math.floor(self.activeTab.renderer.viewPos[1]);
            self.findString(target, pos, false, function(hit, canceled){
                if (!hit && !canceled) {
                    self.trigger(CHANGE.DIALOG_MODAL_ERROR, `"${target}" is not found.`);
                }
                self.trigger(CHANGE.PANE_CONTENT_UPDATE);
            });
        });

        // Find a next string
        self.on(ACTION.KONATA_FIND_NEXT_STRING, function(){
            if (!self.activeTab) {
                return;
            }

            let findContext = self.activeTab.findContext;
            if (!findContext.found) {
                return;
            }

            let pos = self.activeTab.renderer.getPosY_FromOp(findContext.op);
            self.findString(findContext.targetPattern, pos, false, function(hit, canceled){
                if (!hit && !canceled) {
                    self.trigger(CHANGE.DIALOG_MODAL_ERROR, `"${findContext.targetPattern}" is not found.`);
                }
                self.trigger(CHANGE.PANE_CONTENT_UPDATE);
            });
        });

        // Find a previous string
        self.on(ACTION.KONATA_FIND_PREV_STRING, function(){
            if (!self.activeTab) {
                return;
            }

            let findContext = self.activeTab.findContext;
            if (!findContext.found) {
                return;
            }

            let pos = self.activeTab.renderer.getPosY_FromOp(findContext.op);
            self.findString(findContext.targetPattern, pos, true, function(hit, canceled){
                if (!hit && !canceled) {
                    self.trigger(CHANGE.DIALOG_MODAL_ERROR, `"${findContext.targetPattern}" is not found.`);
                }
                self.trigger(CHANGE.PANE_CONTENT_UPDATE);
            });
        });

        self.on(ACTION.KONATA_FIND_HIDE_RESULT, function(){
            if (!self.activeTab) {
                return;
            }

            let findContext = self.activeTab.findContext;
            findContext.visibility = false;
            findContext.findID++;
            self.trigger(CHANGE.PANE_CONTENT_UPDATE);
        });

        self.on(ACTION.KONATA_SET_BOOKMARK, function(index){
            let b = self.config.bookmarks[index];
            let tab = self.activeTab;
            let renderer = tab.renderer;
            b.x = Math.floor(renderer.viewPos[0]);
            b.y = Math.floor(renderer.viewPos[1]);
            b.zoom = renderer.zoomLevel;

            // リロード時に消えないように保存
            self.config.save(); 
        });
        self.on(ACTION.KONATA_GO_TO_BOOKMARK, function(index){
            let b = self.config.bookmarks[index];
            let tab = self.activeTab;
            let renderer = tab.renderer;

            // 1回アニメーションをどっちも終わらしておかないと，基準点がずれる
            self.finishScroll();
            self.finishZoom();


            self.startScroll(
                [b.x - renderer.viewPos[0], b.y - renderer.viewPos[1]], 
                0.5
            );
            // 位置補正を行うと，ブックマークで指定した位置にいけない
            self.startZoom(b.zoom - renderer.zoomLevel, b.x, b.y, 0.5, false);
        });
    }

}


module.exports.Store = Store;
module.exports.ACTION = ACTION;
module.exports.CHANGE = CHANGE;

