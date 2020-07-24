/**
 * The visualization controller will works as a state machine.
 * See files under the `doc` folder for transition descriptions.
 * See https://github.com/jakesgordon/javascript-state-machine
 * for the document of the StateMachine module.
 */

var Controller = StateMachine.create({
    initial: 'none',
    events: [
        {
            name: 'init',
            from: 'none',
            to: 'ready'
        }
        ,
        {
            name: 'search',
            from: 'starting',
            to: 'searching'
        },
        {
            name: 'pause',
            from: 'searching',
            to: 'paused'
        },
        {
            name: 'finish',
            from: 'searching',
            to: 'finished'
        },
        {
            name: 'resume',
            from: 'paused',
            to: 'searching'
        },
        {
            name: 'cancel',
            from: 'paused',
            to: 'ready'
        },
        {
            name: 'modify',
            from: 'finished',
            to: 'modified'
        },
        {
            name: 'reset',
            from: '*',
            to: 'ready'
        },
        {
            name: 'clear',
            from: ['finished', 'modified'],
            to: 'ready'
        },
        {
            name: 'start',
            from: ['ready', 'modified', 'restarting'],
            to: 'starting'
        },
        {
            name: 'restart',
            from: ['searching', 'finished'],
            to: 'restarting'
        },
        {
            name: 'dragStart',
            from: ['ready', 'finished'],
            to: 'draggingStart'
        },
        {
            name: 'dragEnd',
            from: ['ready', 'finished'],
            to: 'draggingEnd'
        },
        {
            name: 'changeNode',
            from: ['ready', 'finished'],
            to: 'changingNode'
        },
        {
            name: 'rest',
            from: ['draggingStart', 'draggingEnd', 'changingNode'],
            to: 'ready'
        },
    ],
});

$.extend(Controller, {
    gridSize: [64, 64], // number of nodes horizontally and vertically
    operationsPerSecond: 300,
    path: [],
    operations: [],
    grayval: 2,
    /**
 * Asynchronous transition from `none` state to `ready` state.
 */
    onleavenone: function () {
        console.log('==> none left');
        var numCols = this.gridSize[0],
            numRows = this.gridSize[1];

        this.grid = new map(numCols, numRows, 1);//div grid declaration
        this.values = new map(this.gridSize[0], this.gridSize[1], 0),
            // this.grid1.print_map();
            View.init({
                numCols: numCols,
                numRows: numRows
            });
        View.generateGrid(function () {
            Controller.setDefaultStartEndPos();
            Controller.bindEvents();
            Controller.transition(); // transit to the next state (ready)
        });

        this.$buttons = $('.control_button');

        this.hookPathFinding();

        return StateMachine.ASYNC;
        // => ready
    },
    onchangeNode: function (event, from, to, gridX, gridY, val) {
        console.log('==> changeNode');
        console.log(val);
        this.setWalkableAt(gridX, gridY, val);
        // => changingNode
    },
    onsearch: function (event, from, to) {
        console.log('==> search')
        var grid = this.grid,
            query = Panel.getFinder();
        grid.matrix[this.startY][this.startX] = "S";
        grid.matrix[this.endY][this.endX] = "E";
        query['gridsize'] = JSON.stringify(this.gridSize);
        query['grid'] = JSON.stringify(this.grid.matrix);
        query['start'] = JSON.stringify([this.startX, this.startY]);
        endpoints = [];
        for (i = 0; i < this.gridSize[1]; i++) {
            for (j = 0; j < this.gridSize[0]; j++) {
                if (grid.matrix[j][i] == 'E')
                    endpoints.push([i, j]);
            }
        }
        query['endpoints'] = JSON.stringify(endpoints);
        console.log(query);
        var datum;
        $.ajax({
            url: window.location.href + '/tspapi',
            type: 'post',
            async: false,
            data: query,
            dataType: 'json',
            success: function (data) {
                datum = data;
            }
        });
        // console.log(query['grid']);
        this.path = datum['path_nodes'];
        console.log(this.path);
        this.operations = [];
        // console.log(this.path);
        // this.path=data['']
        this.operationCount = 0;
        this.timeSpent = datum['time'];//div change this
        this.length = datum['length'];
        this.loop();
        // => searching
    },
    onrestart: function () {
        // When clearing the colorized nodes, there may be
        // nodes still animating, which is an asynchronous procedure.
        // Therefore, we have to defer the `abort` routine to make sure
        // that all the animations are done by the time we clear the colors.
        // The same reason applies for the `onreset` event handler.
        setTimeout(function () {
            Controller.clearOperations();
            Controller.clearFootprints();
            Controller.start();
        }, View.nodeColorizeEffect.duration * 1.2);
        // => restarting
    },
    onpause: function (event, from, to) {
        // => paused
    },
    onresume: function (event, from, to) {
        this.loop();
        // => searching
    },
    oncancel: function (event, from, to) {
        this.clearOperations();
        this.clearFootprints();
        // => ready
    },
    onfinish: function (event, from, to) {
        View.showStats({
            pathLength: this.length,
            timeSpent: this.timeSpent,
            operationCount: this.operationCount,
        });
        View.drawPath(this.path);
        // console.log(this.path);
        // => finished
    },
    onclear: function (event, from, to) {
        this.clearOperations();
        this.clearFootprints();
        // => ready
    },
    onmodify: function (event, from, to) {
        // => modified
    },
    onreset: function (event, from, to) {
        console.log('==> reset');
        setTimeout(function () {
            Controller.clearOperations();
            Controller.clearAll();
            Controller.buildNewGrid();
        }, View.nodeColorizeEffect.duration * 1.2);
        // => ready
    },

    /**
     * The following functions are called on entering states.
     */

    onready: function () {
        console.log('=> ready');
        this.setButtonStates({
            id: 1,
            text: 'Start Search',
            enabled: true,
            callback: $.proxy(this.start, this),
        }, {
            id: 2,
            text: 'Pause Search',
            enabled: false,
        }, {
            id: 3,
            text: 'Clear Walls',
            enabled: true,
            callback: $.proxy(this.reset, this),
        });
        // => [starting, draggingStart, draggingEnd, drawingStart, drawingEnd]
    },
    onstarting: function (event, from, to) {
        console.log('=> starting');
        // Clears any existing search progress
        this.clearFootprints();
        this.setButtonStates({
            id: 2,
            enabled: true,
        });
        this.search();
        // => searching
    },
    onsearching: function () {
        console.log('=> searching');
        this.setButtonStates({
            id: 1,
            text: 'Restart Search',
            enabled: true,
            callback: $.proxy(this.restart, this),
        }, {
            id: 2,
            text: 'Pause Search',
            enabled: true,
            callback: $.proxy(this.pause, this),
        });
        // => [paused, finished]
    },
    onpaused: function () {
        console.log('=> paused');
        this.setButtonStates({
            id: 1,
            text: 'Resume Search',
            enabled: true,
            callback: $.proxy(this.resume, this),
        }, {
            id: 2,
            text: 'Cancel Search',
            enabled: true,
            callback: $.proxy(this.cancel, this),
        });
        // => [searching, ready]
    },
    onfinished: function () {
        console.log('=> finished');
        this.setButtonStates({
            id: 1,
            text: 'Restart Search',
            enabled: true,
            callback: $.proxy(this.restart, this),
        }, {
            id: 2,
            text: 'Clear Path',
            enabled: true,
            callback: $.proxy(this.clear, this),
        });
    },
    onmodified: function () {
        console.log('=> modified');
        this.setButtonStates({
            id: 1,
            text: 'Start Search',
            enabled: true,
            callback: $.proxy(this.start, this),
        }, {
            id: 2,
            text: 'Clear Path',
            enabled: true,
            callback: $.proxy(this.clear, this),
        });
    },

    /**
     * Define setters and getters of PF.Node, then we can get the operations
     * of the pathfinding.
     */
    hookPathFinding: function () {

        //     PF.Node.prototype = {
        //         get opened() {
        //             return this._opened;
        //         },
        //         set opened(v) {
        //             this._opened = v;
        //             Controller.operations.push({
        //                 x: this.x,
        //                 y: this.y,
        //                 attr: 'opened',
        //                 value: v
        //             });
        //         },
        //         get closed() {
        //             return this._closed;
        //         },
        //         set closed(v) {
        //             this._closed = v;
        //             Controller.operations.push({
        //                 x: this.x,
        //                 y: this.y,
        //                 attr: 'closed',
        //                 value: v
        //             });
        //         },
        //         get tested() {
        //             return this._tested;
        //         },
        //         set tested(v) {
        //             this._tested = v;
        //             Controller.operations.push({
        //                 x: this.x,
        //                 y: this.y,
        //                 attr: 'tested',
        //                 value: v
        //             });
        //         },
        //     };

        this.operations = [];
    },
    bindEvents: function () {
        $('#draw_area').mousedown($.proxy(this.mousedown, this));
        $(window)
            .mousemove($.proxy(this.mousemove, this))
            .mouseup($.proxy(this.mouseup, this));
    },
    loop: function () {
        console.log('==>loop');
        var interval = 1000 / this.operationsPerSecond;
        (function loop() {
            if (!Controller.is('searching')) {
                return;
            }
            Controller.step();
            setTimeout(loop, interval);
        })();
    },
    step: function () {
        var operations = this.operations,
            op, isSupported;
        // console.log("==> step");
        do {
            if (!operations.length) {
                this.finish(); // transit to `finished` state
                return;
            }
            // console.log("==> ok");
            op = operations.shift();
            // console.log(op);
            isSupported = View.supportedOperations.indexOf(op[1]) !== -1;
        } while (!isSupported);
        View.setAttributeAt(op[0][0], op[0][1], op[1], op[2]);
    },
    clearOperations: function () {
        this.operations = [];
    },
    clearFootprints: function () {
        View.clearFootprints();
        View.clearPath();
    },
    clearAll: function () {
        this.clearFootprints();
        View.clearBlockedNodes();
    },
    buildNewGrid: function () {
        this.grid = new map(this.gridSize[0], this.gridSize[1], 1);// div create grid
        this.values = new map(this.gridSize[0], this.gridSize[1], 0);
    },
    mousedown: function (event) {
        var coord = View.toGridCoordinate(event.pageX, event.pageY),
            gridX = coord[0],
            gridY = coord[1],
            grid = this.grid;
        console.log([gridX, gridY]);
        if (this.can('dragStart') && this.isStartPos(gridX, gridY)) {
            this.dragStart();
            return;
        }
        if (this.can('dragEnd') && this.isEndPos(gridX, gridY)) {
            this.dragEnd();
            return;
        }
        if (this.can('changeNode') && !this.isStartOrEndPos(gridX, gridY)) {
            console.log('just');
            var val = this.values.matrix[gridY][gridX];
            val = (val + 1) % 4;
            var grayval = parseInt($('#custom_weight_section .gray_w').val()) || 1;
            grayval = grayval > 0 ? grayval : 2;
            var list = [];
            list.push(1);
            list.push(grayval);
            list.push('B');
            list.push('E');
            this.grayval = grayval;
            console.log(list[1]);
            this.values.matrix[gridY][gridX] = val;
            grid.matrix[gridY][gridX] = list[val];
            this.changeNode(gridX, gridY, val);
            console.log('changed!!!');
            return;
        }
    },
    mousemove: function (event) {
        var coord = View.toGridCoordinate(event.pageX, event.pageY),
            grid = this.grid,
            gridX = coord[0],
            gridY = coord[1];

        if (this.isStartOrEndPos(gridX, gridY)) {
            return;
        }

        switch (this.current) {// div this.current denotes current state of state map
            case 'draggingStart':
                if (grid.is_normal(gridX, gridY)) {
                    this.setStartPos(gridX, gridY);
                }
                break;
            case 'draggingEnd':
                if (grid.is_normal(gridX, gridY)) {
                    this.setEndPos(gridX, gridY);
                }
                break;
            case 'changingNode':
                console.log('changingNode');
                this.setWalkableAt(gridX, gridY, grid.matrix[gridY][gridX]);
                break;
        }
    },
    mouseup: function (event) {
        if (Controller.can('rest')) {
            Controller.rest();
        }
    },
    setButtonStates: function () {
        $.each(arguments, function (i, opt) {
            var $button = Controller.$buttons.eq(opt.id - 1);
            if (opt.text) {
                $button.text(opt.text);
            }
            if (opt.callback) {
                $button
                    .unbind('click')
                    .click(opt.callback);
            }
            if (opt.enabled === undefined) {
                return;
            } else if (opt.enabled) {
                $button.removeAttr('disabled');
            } else {
                $button.attr({ disabled: 'disabled' });
            }
        });
    },
    //     /**
    //      * When initializing, this method will be called to set the positions
    //      * of start node and end node.
    //      * It will detect user's display size, and compute the best positions.
    //      */
    setDefaultStartEndPos: function () {
        var width, height,
            marginRight, availWidth,
            centerX, centerY,
            endX, endY,
            nodeSize = View.nodeSize;

        width = $(window).width();
        height = $(window).height();

        marginRight = $('#algorithm_panel').width();
        availWidth = width - marginRight;

        centerX = Math.ceil(availWidth / 2 / nodeSize);
        centerY = Math.floor(height / 2 / nodeSize);

        this.setStartPos(centerX - 5, centerY);
        this.setEndPos(centerX + 5, centerY);

        // this.setStartPos(0, 0)
        // this.setEndPos(2, 2)
    },
    setStartPos: function (gridX, gridY) {
        this.startX = gridX;
        this.startY = gridY;
        // this.grid.matrix[gridY][gridX] = 'S';
        View.setStartPos(gridX, gridY);
    },
    setEndPos: function (gridX, gridY) {
        this.endX = gridX;
        this.endY = gridY;
        // this.grid.matrix[gridY][gridX] = 'E';
        View.setEndPos(gridX, gridY);
    },
    setWalkableAt: function (gridX, gridY, walkable) {
        console.log('==> set walkable at');
        // console.log(gridX);
        // this.grid.matrix[gridY][gridX] = list[walkable]
        // console.log(this.grid.matrix[gridY][gridX]);
        View.setAttributeAt(gridX, gridY, 'walkable', walkable, this.grayval);
    },
    isStartPos: function (gridX, gridY) {
        return gridX === this.startX && gridY === this.startY;
    },
    isEndPos: function (gridX, gridY) {
        return gridX === this.endX && gridY === this.endY;
    },
    isStartOrEndPos: function (gridX, gridY) {
        return this.isStartPos(gridX, gridY) || this.isEndPos(gridX, gridY);
    },
});
