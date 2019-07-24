import React from 'react';
import * as Rx from 'rxjs';
import * as _ from 'lodash';
import classnames from 'classnames';
import moment from 'moment';
import TimelineUtil from './timeline-util'
import styles from './timeline.less'
import Logger from 'log4jkjs';
import CanvasUtils from './CanvasUtils';

// 创建日志管理
let logger = new Logger("/TimeLine/MultipleTimeline.jsx [MultipleTimeline]");
logger.config('debug', 'black', 'console');


let TICK_HEIGHT = 30;
const TICK_MAIN = 8;
const TICK_MINOR = 5;
let TIMELINE_HEIGHT = 20;
const LINE_WIDTH = 1;
const FONT = '12px 微软雅黑';
const TEXT_ALIGN = 'center';
const TICK_COLOR = 'rgb(143, 145, 146)';
const TEXT_COLOR = 'rgb(255, 255, 255)';
const SELECTED_TEXT_COLOR = 'rgb(100, 255, 0)';
const TICK_MAIN_WIDTH = 2;
const TICK_MINOR_WIDTH = 1;
let LINE_HEIGHT = 20;
const TIMELINE_INDEX_TEXT_WIDTH = 17;

//鼠标进行移动的相关的类
class ActionStatus {
  constructor() {
    this.shifting = false
    this.animating = false
    this.speed = null
    this.originMouseInfo = null
    this.oldMouseInfo = null
    this.mouseInfo = null
  }

  setMouseInfo(e) {
    logger.debug('setMouseInfo()');
    this.oldMouseInfo = this.mouseInfo;
    this.mouseInfo = TimelineUtil.getMouseInfo(e);
    return this.oldMouseInfo;
  }

  isMoveLeft() {
    logger.debug('isMoveLeft()');
    if (this.mouseInfo.x === this.originMouseInfo.x) {
      return this.mouseInfo.y < this.originMouseInfo.y;
    } else {
      return this.mouseInfo.x < this.originMouseInfo.x;
    }
  }
  //计算速度
  calcSpeed(old) {
    logger.debug('calcSpeed(), old:', old);
    if (!old || this.mouseInfo.timeStamp === old.timeStamp) {
      this.speed = null;
      return 0;
    } else {
      var distance = Math.max(TimelineUtil.calcDistance(this.mouseInfo, old), 1);
      var speed = distance * 10 / Math.abs(this.mouseInfo.timeStamp - old.timeStamp);

      var sign = this.isMoveLeft() ? 1 : -1;
      this.speed = parseInt(speed * sign);

      return this.speed;
    }
  }
};

class MultipleTimeline extends React.Component {
  static SpanArray = [
    // '15m',
    // '30m',
    '1h',
    '2h',
    '4h',
    '6h',
    '12h',
    '24h'
  ];
  static SpanSetting = {
    // '15m': {
    //   totalTime: 900000,  // 总时长
    //   unitTime: 300000,   // 主刻度间隔 5m
    //   minorTicks: 10       // 小刻度个数 1m
    // },
    // '30m': {
    //   totalTime: 1800000,
    //   unitTime: 600000, // 10m
    //   minorTicks: 10 // 2m
    // },
    '1h': {
      totalTime: 3600000,
      unitTime: 1200000, // 20m
      minorTicks: 10 // 5m
    },
    '2h': {
      totalTime: 7200000,
      unitTime: 1800000, // 30m
      minorTicks: 10 // 5m
    },
    '4h': {
      totalTime: 14400000,
      unitTime: 3600000, // 1h
      minorTicks: 10 // 10m
    },
    '6h': {
      totalTime: 21600000,
      unitTime: 3600000, // 2h
      minorTicks: 10 // 20m
    },
    '12h': {
      totalTime: 43200000,
      unitTime: 10800000, // 3h
      minorTicks: 10 // 30m
    },
    '24h': {
      totalTime: 86400000,
      unitTime: 14400000, // 8h
      minorTicks: 10 // 2h
    },
  }
  constructor(props) {
    super(props);
    this.state = {
      span: props.defaultSpan || '24h',
      _startTime: new Date(),
      selectedIndex: 0,
      show: true,
      timelineStartTime: props.starttime || new Date(moment().startOf("day").valueOf()),
    };
    this.actionStatus = new ActionStatus();
    this.rightDate = moment().subtract(1, 'days');
    this.mouseDownPosition = null;
    this.mouseUpPosition = null;

    [
      'handleResize',
      'handleTouchStart',
      'handleTouchMove',
      'handleTouchEnd',
      'handleDoubleClick',
      'handleMouseDown',
      'handleMouseMove',
      'handleMouseUp',
      'handleMouseWheel',
      'handleBlur'
    ].forEach(f => this[f] = this[f].bind(this));
  }

  static setIndicator = (prop) => {
    this.setState({
      show: prop
    });
  }

  componentDidMount() {
    window.addEventListener('resize', this.handleResize)
    this.initStartTime();
    this.handleResize();
    this.draw();
    this.forceUpdate && this.forceUpdate();
    if (this.props.onCreated) {
      this.props.onCreated(this);
    }

    window.addEventListener('mousemove', this.handleMouseMoveTip)
  }

  componentWillReceiveProps(nextProps) {
    logger.log('componentWillReceiveProps(), nextProps:', nextProps);

    if (!this.actionStatus.shifting && this.props.playtime.getTime() != nextProps.playtime.getTime()) {
      logger.log('componentWillReceiveProps(), this.state._startTime:', this.state._startTime, 'nextProps.playtime:', nextProps.playtime);
      this.setStartTime(nextProps.playtime);
    }

    if (nextProps.playtime.getTime() != this.props.playtime.getTime() && !this.hasMove) {
      this.setStartTime(nextProps.playtime);
      // this.drawIndicator();
      // this.setState({
      //   _startTime: nextProps.playtime,
      // })
    }

    if (nextProps.selectedIndex != this.props.selectedIndex) {
      logger.log('componentWillReceiveProps() -> this.draw()');
      this.setState({
        selectedIndex: nextProps.selectedIndex,
      }, () => {
        this.drawTimelines();
      });
    }

    if (!_.isEqual(this.props.starttime, nextProps.starttime)) {
      this.setTimelineStartTime(nextProps.starttime)
      // this.setState({
      //   timelineStartTime: nextProps.starttime,
      // }, () => {
      //   this.draw();
      // })
    }

    // logger.log('componentWillReceiveProps(), nextProps.records != this.props.records:', nextProps.records, this.props.records, nextProps.records != this.props.records)
    // if (nextProps.records != this.props.records) {
    //   this.draw();
    // }
  }
  // setSpan(span, cb) {
  //   if (this.state.span !== span) {
  //     this.setState({
  //       span
  //     }, () => {
  //       if (!!cb) cb();
  //       this.tickShifting()
  //     });
  //   }
  // }

  //组件销毁
  componentWillUnmount() {
    window.removeEventListener('resize', this.handleResize)
    this.removeDocumentEvents();
    this.resetDragInterval();

    this.props.onCreated && this.props.onCreated(null);
    window.removeEventListener('mousemove', this.handleMouseMoveTip)
  }

  //清除定时器功能
  resetDragInterval() {
    if (this.dragInterval) {
      clearInterval(this.dragInterval);
      this.dragInterval = null;
    }
  }

  // 监听鼠标位置做出对应提示
  handleMouseMoveTip(e) {
    if (!this._container) return;

    this._containerRect = this._container.getBoundingClientRect();
    const width = this._containerRect.width;
    const height = this._containerRect.height;
    logger.debug('handleMouseMoveTip, e:', e, 'e.nativeEvent.offsetX:', e.nativeEvent.offsetX, 'e.nativeEvent.offsetY:', e.nativeEvent.offsetY, 'width:', width, 'height:', height);

  }

  //绑定时间使用rxjs
  addDocumentMouseEvents() {
    this.mouseMoveObserver = this.hasMove && Rx.Observable.fromEvent(document, 'mousemove')
      .subscribe(this.handleMouseMove);
    this.mouseUpObserver = Rx.Observable.fromEvent(document, 'mouseup')
      .subscribe(this.handleMouseUp);
  }

  addDocumentTouchEvents() {
    this.touchMoveObserver = Rx.Observable.fromEvent(document, 'touchmove')
      .subscribe(this.handleTouchMove);
    this.touchUpObserver = Rx.Observable.fromEvent(document, 'touchend')
      .subscribe(this.handleTouchEnd);
  }
  //移除事件
  removeDocumentEvents() {
    if (this.mouseMoveObserver) {
      this.mouseMoveObserver.unsubscribe();
      this.mouseMoveObserver = null;
    }

    if (this.mouseUpObserver) {
      this.mouseUpObserver.unsubscribe();
      this.mouseUpObserver = null;
    }

    if (this.touchMoveObserver) {
      this.touchMoveObserver.unsubscribe();
      this.touchMoveObserver = null;
    }

    if (this.touchUpObserver) {
      this.touchUpObserver.unsubscribe();
      this.touchUpObserver = null;
    }
  }

  startAnimation() {
    if (this.actionStatus.animating) {
      this.actionStatus.animating = false;
      // if (!this.actionStatus.shifting && this.props.onTimeChangecb) {
      //   logger.debug('startAnimation(), this.getStartTime():', this.getStartTime(), 'this.getIndicatorTime():', this.getIndicatorTime());
      //   this.props.onTimeChangecb(this.getStartTime(), this.getIndicatorTime());
      // }
      //self.tickAnimation();
    } else if (this.actionStatus.shifting) {
      this.tickShifting();
    }
  }

  cancelAnimation() {
  }

  //根据浏览器的刷新速度进行延时操作
  tickShifting() {
    requestAnimationFrame(() => {
      this.draw();
    })
  }

  draw() {
    logger.debug('draw()');
    this.drawTicks()
    this.drawTimelines();
    // this.drawMain()
    this.drawIndicator()
    // this.drawBkg()
  }

  //进行属性的更新
  getTickStyle() {
    let tickStyle = {
      font: '12px 微软雅黑',
      textAlign: 'center',
      textBaseline: 'top',
      textColor: 'rgb(168, 168, 168)',
      mainHeight: 29,
      mainWidth: 2,
      mainColor: 'rgb(168, 168, 168)',
      minorHeight: 15,
      minorWidth: 1,
      minorColor: 'rgb(168, 168, 168)',
    }

    return _.assign(tickStyle, this.props.tickStyle);
  }

  drawTicks() {
    logger.debug('drawTicks()');
    const { timelineCount } = this.props;
    var tickHeight = TICK_HEIGHT - LINE_WIDTH;
    let left = TIMELINE_INDEX_TEXT_WIDTH + LINE_WIDTH;

    const ctx = CanvasUtils.init(this._canvasTicks, { "left": left });

    const spanSetting = this.getSpanSetting()
    const minorUnit = spanSetting.unitTime / spanSetting.minorTicks
    const start = this.getTimelineStartTime()
    const end = this.getTimelineEndTime()

    const times = TimelineUtil.getDateTimeLineTicks(
      start, end, spanSetting.unitTime, minorUnit)

    logger.log('getMultipleTimelineTicks(), times:', times);

    // const tickStyle = this.getTickStyle()
    ctx.font = FONT;
    ctx.textAlign = TEXT_ALIGN;
    ctx.textBaseline = 'top';

    let context = this;
    times.forEach(function (t) {
      const strTime = moment(t.time).format('HH:mm');
      let timeX = context.timeToX(t.time)
      if (timeX > 19) {
        let drawText = false
        if (t.type === 'main') {
          CanvasUtils.stroke(ctx, timeX, tickHeight - TICK_MAIN, timeX, tickHeight, TICK_MAIN_WIDTH, TICK_COLOR);
          drawText = true
        } else if (t.type === 'minor') {
          CanvasUtils.stroke(ctx, timeX, tickHeight - TICK_MINOR, timeX, tickHeight, TICK_MINOR_WIDTH, TICK_COLOR);
        }

        if (drawText) {
          const textWidth = ctx.measureText(strTime).width
          if (timeX - textWidth / 2 <= TIMELINE_INDEX_TEXT_WIDTH + LINE_WIDTH) {
            timeX = textWidth / 4 * 3 + TIMELINE_INDEX_TEXT_WIDTH + LINE_WIDTH
          } else if (timeX + textWidth / 2 >= ctx.canvas.width) {
            timeX = ctx.canvas.width - textWidth / 4 * 3
          }

          ctx.beginPath()
          ctx.fillStyle = TICK_COLOR;
          ctx.fillText(strTime, timeX, timelineCount === 1 ? 12 : 2);
        }
      }

    })

    ctx.beginPath()
    ctx.moveTo(0, tickHeight + 1)
    ctx.lineTo(ctx.canvas.width, tickHeight + 1)
    ctx.strokeStyle = 'rgb(4, 5, 6)'
    ctx.lineWidth = LINE_WIDTH
    ctx.stroke()

    ctx.restore()
  }
  //画出时间线的背景
  // drawBkg() {
  //   logger.debug('drawBkg()');

  //   const ctx = CanvasUtils.init(this._canvasBkg);

  //   const maskWidth = 200;
  //   const maskHeight = 14;
  //   const maskleft = (width - maskWidth) / 2;
  //   var my_gradient = ctx.createLinearGradient(maskleft, 0, maskleft + maskWidth, 0);
  //   my_gradient.addColorStop(0, "rgba(22,19,33,0.2)");
  //   my_gradient.addColorStop(0.3, "rgba(22,19,33,1)");
  //   my_gradient.addColorStop(0.7, "rgba(22,19,33,1)");
  //   my_gradient.addColorStop(1, "rgba(22,19,33,0.2)");
  //   ctx.fillStyle = my_gradient;
  //   ctx.fillRect(maskleft + this.offLeftWidth, height * rate + 3, maskWidth, maskHeight);

  //   ctx.restore()
  // }

  // 画时间轴
  drawTimelines() {
    logger.debug('drawTimelines()');
    const { timelineCount } = this.props;
    // 初始化 canvas
    const ctx = CanvasUtils.init(this._canvasMain);
    // 画时间轴所有部分
    this.drawLine(ctx, timelineCount);

    ctx.restore()
  }

  // 画左右边框
  drawFrame(ctx, amount) {
    CanvasUtils.stroke(ctx, 0, TICK_HEIGHT, 0, 20 * amount, 2, "rgb(4, 5, 6)");
    CanvasUtils.stroke(ctx, ctx.canvas.width, TICK_HEIGHT, ctx.canvas.width, 20 * amount, 1, "rgb(4, 5, 6)");
  }

  // 画时间轴上的刻度分割线
  drawTickLine(ctx, amount) {
    const spanSetting = this.getSpanSetting()
    const minorUnit = spanSetting.unitTime / spanSetting.minorTicks
    const start = this.getTimelineStartTime()
    const end = this.getTimelineEndTime()

    // 获取所有刻度
    const times = TimelineUtil.getDateTimeLineTicks(start, end, spanSetting.unitTime, minorUnit)

    let context = this;
    times.forEach(t => {
      // 根据主刻度的位置画时间轴刻度分割线
      let timeX = context.timeToX(t.time)
      if (t.type === 'main') {
        CanvasUtils.stroke(ctx, timeX - 0.5, TICK_HEIGHT, timeX - 0.5, TICK_HEIGHT + TIMELINE_HEIGHT * amount, LINE_WIDTH, 'rgb(4, 5, 6)');
      }
    })
  }

  // 画时间轴所有部分
  drawLine(ctx, amount) {
    const { selectedIndex } = this.state;
    const { videoList } = this.props;

    // 画所有时间轴的整体底色
    CanvasUtils.fillRect(ctx, 0, TICK_HEIGHT, ctx.canvas.width, TIMELINE_HEIGHT * amount, "rgb(38, 43, 51)");
    if (amount === 1) LINE_HEIGHT = 80, TIMELINE_HEIGHT = 80, TICK_HEIGHT = 40, this._container.style.height = 90 + "px";
    // 逐个画出时间轴
    for (let indexY = 0; indexY < amount; indexY++) {
      // 画录像段
      this.drawRecordFiles(ctx, indexY);
      // 画左侧数字底色，根据是否有设备用不同的颜色
      let leftColor = "rgb(24, 28, 31)";
      if (indexY < videoList.length) {
        leftColor = "rgb(218, 109, 42)";
      }
      CanvasUtils.fillRect(ctx, LINE_WIDTH, TICK_HEIGHT + TIMELINE_HEIGHT * indexY, 17, TIMELINE_HEIGHT, leftColor);
      // 画左侧数字
      let textColor = indexY == selectedIndex ? SELECTED_TEXT_COLOR : TEXT_COLOR;
      CanvasUtils.fillText(ctx, indexY + 1, 10, TICK_HEIGHT + LINE_HEIGHT * indexY + (amount === 1 ? 40 : 13), textColor, TEXT_COLOR, TEXT_ALIGN);
      // 画时间轴 底部 分割线
      CanvasUtils.stroke(ctx, 0, TICK_HEIGHT + LINE_HEIGHT * (indexY + 1) - 0.5, ctx.canvas.width, TICK_HEIGHT + LINE_HEIGHT * (indexY + 1) - 0.5, LINE_WIDTH, "rgba(4, 5, 6, 1)");
    }

    // 画左右边框
    this.drawFrame(ctx, amount);

    // 画时间轴上的刻度分割线
    this.drawTickLine(ctx, amount);
  }

  drawRecordFiles(ctx, index) {
    var { records, selectedIndex } = this.props;
    logger.debug('drawRecordFiles(), index:', index, 'records:', records, 'files:', records[index], 'selectedIndex:', selectedIndex);
    var files = records[index];
    if (!files || files.length <= 0) return

    var context = this;
    files.forEach(function (f) {
      const start = context.timeToX(new Date(f.starttime * 1000))
      const end = context.timeToX(new Date(f.endtime * 1000))

      // if (end <= 0 || start >= ctx.canvas.width) return

      ctx.beginPath()
      ctx.moveTo(start, TICK_HEIGHT + TIMELINE_HEIGHT * index)
      ctx.lineTo(start, TICK_HEIGHT + TIMELINE_HEIGHT * index + TIMELINE_HEIGHT - LINE_WIDTH)
      ctx.lineTo(end, TICK_HEIGHT + TIMELINE_HEIGHT * index + TIMELINE_HEIGHT - LINE_WIDTH)
      ctx.lineTo(end, TICK_HEIGHT + TIMELINE_HEIGHT * index)
      ctx.closePath();

      if (selectedIndex == index) {
        ctx.fillStyle = 'rgb(215, 156, 30)'
      } else {
        ctx.fillStyle = 'rgb(3, 123, 221)'
      }

      ctx.fill()
    })
    ctx.restore();
  }

  getTimeParse = (date) => {
    if (date) {
      var year = date.getFullYear();
      var month = date.getMonth() + 1;
      var day = date.getDate();
      if (month < 10) {
        month = "0" + month;
      }
      if (day < 10) {
        day = "0" + day;
      }
      return '' + year + month + day;
    }
  }

  compareTime = (moveTime) => {
    const time = this.getTimeParse(new Date());
    const time2 = this.getTimeParse(moveTime);
    logger.log('compareTime(), time:', time, 'time2', time2);
    return time == time2;
  }

  drawIndicator() {
    const { playtime } = this.props;
    logger.debug('drawIndicator(), playtime:', playtime);
    if (!playtime) {
      return;
    }

    const ctx = CanvasUtils.init(this._canvasInd);

    const indicatorTime = playtime;
    logger.debug('drawIndicator(), indicatorTime:', indicatorTime);
    var flag = this.compareTime(indicatorTime);
    var midstr;
    if (flag) {
      midstr = moment(indicatorTime).format('HH:mm:ss');
    } else {
      midstr = moment(indicatorTime).format('YYYY-MM-DD HH:mm:ss');
    }
    logger.debug('drawIndicator(), midstr:', midstr, 'ctx.canvas.width:', ctx.canvas.width);
    // const middleX = ctx.canvas.width / 2 + 9
    const indicatorTimeX = this.timeToX(indicatorTime);

    if (indicatorTimeX > 19) {
      ctx.beginPath()
      ctx.moveTo(indicatorTimeX - 6, ctx.canvas.height)
      ctx.lineTo(indicatorTimeX + 6, ctx.canvas.height)
      ctx.lineTo(indicatorTimeX, ctx.canvas.height - 6)
      ctx.closePath();

      ctx.fillStyle = 'rgba(252, 87, 31, 1)'
      ctx.fill()

      ctx.beginPath()
      ctx.moveTo(indicatorTimeX, ctx.canvas.height - 5)
      ctx.lineTo(indicatorTimeX, 0);
      ctx.strokeStyle = 'rgb(252, 87, 31)'
      ctx.lineWidth = 2
      ctx.stroke()

      ctx.font = '12px 微软雅黑'
      ctx.textAlign = 'center'

      this.offLeftWidth = ctx.measureText(midstr).width / 2 + 5;

      ctx.fillStyle = 'rgba(22,19,33,1)';
      ctx.fillRect(indicatorTimeX + 2, 2, ctx.measureText(midstr).width + 8, 15);

      ctx.beginPath()
      ctx.fillStyle = 'rgb(168, 168, 168)'
      ctx.fillText(midstr, indicatorTimeX + this.offLeftWidth, 14);

      ctx.restore()
    }
  }

  getAllCanvas() {
    logger.debug('getAllCanvas()');
    return [
      this._canvasTicks,
      this._canvasInd,
      this._canvasMain,
      // this._canvasBkg,
      // this._canvasDates,
    ]
  }

  handleResize(e) {
    logger.debug('handleResize()');
    if (!this._container) return;

    this._containerRect = this._container.getBoundingClientRect();
    const width = this._containerRect.width;
    const height = this._containerRect.height;
    //获取所有canvas对象
    const canvas = this.getAllCanvas()
    canvas.forEach((c) => {
      if (c) {
        const style = window.getComputedStyle(c)
        c.width = width
        c.height = height +
          (-parseInt(style.marginTop)) +
          (-parseInt(style.marginBottom))
      }
    })

    this.tickShifting()
  }

  handleTouchStart(e) {
    logger.debug('handleTouchStart(), e:', e);
    const info = TimelineUtil.convertTouchInfo(e);
    this.moveStart(info);

    this.addDocumentTouchEvents();
  }

  handleTouchMove(e) {
    logger.debug('handleTouchMove(), e:', e);
    const info = TimelineUtil.convertTouchInfo(e);
    const { left, right } = this._containerRect;

    if (left <= info.clientX && info.clientX <= right) {
      this.resetDragInterval();
      this.moving(info);
    } else {
      this.resetDragInterval();

      if (!this.actionStatus.mouseInfo) return;

      let distance = 0;
      let shiftLeft = false;
      if (info.clientX < left) {
        shiftLeft = true;
        distance = Math.abs(info.clientX - left);
      } else {
        shiftLeft = false;
        distance = Math.abs(info.clientX - right);
      }

      this.dragInterval = setInterval(() => {
        this.shift(distance, shiftLeft);
      }, 300);
    }
  }

  handleTouchEnd(e) {
    logger.debug('handleTouchEnd(), e:', e);
    this.moveEnd();
  }

  handleDoubleClick(e) {
    // e.preventDefault();
    const { timelineCount, selectedIndex } = this.props;
    logger.debug('handleDoubleClick(), e:', e, 'e.nativeEvent.offsetX:', e.nativeEvent.offsetX, 'e.nativeEvent.offsetY:', e.nativeEvent.offsetY);

    if (e.nativeEvent.offsetY < TICK_HEIGHT || e.nativeEvent.offsetY > TICK_HEIGHT + TIMELINE_HEIGHT * timelineCount) {
      return;
    } else {
      // 计算点击哪个时间轴
      let index = parseInt((e.nativeEvent.offsetY - TICK_HEIGHT) / TIMELINE_HEIGHT);
      let timeX = e.nativeEvent.offsetX;
      let time = this.xToTime(timeX);
      logger.log('handleDoubleClick(), time:', time);
      if (index != selectedIndex) {
        !!this.props.onSelectedChange && this.props.onSelectedChange(index);
      }
      !!this.props.onTimeChangecb && this.props.onTimeChangecb(index, time);
    }
  }

  handleMouseDown(e) {
    logger.debug('handleMouseDown(), e:', e, 'e.nativeEvent.offsetX:', e.nativeEvent.offsetX, 'e.nativeEvent.offsetY:', e.nativeEvent.offsetY);
    e.stopPropagation();
    e.preventDefault();

    this.hasMove = true;
    this.mouseDownPosition = [e.nativeEvent.offsetX, e.nativeEvent.offsetY];
    logger.debug('handleMouseDown(), move, this.hasMove:', this.hasMove);
    this.moveStart(e);

    this.addDocumentMouseEvents();
  }

  moveStart(pos) {
    logger.debug('moveStart(), pos:', pos);
    this.resetDragInterval();

    this.actionStatus.setMouseInfo(pos);
    this.actionStatus.originMouseInfo = this.actionStatus.mouseInfo;
    this.actionStatus.oldMouseInfo = null;
    this.actionStatus.shifting = true;
    this.actionStatus.animating = false;
  }

  handleMouseMove(e) {
    this.hasMove = true;
    logger.debug('handleMouseMove(), e:', e);
    e.preventDefault();

    const { left, right } = this._containerRect;
    if (left <= e.clientX && e.clientX <= right) {
      this.resetDragInterval();
      this.moving(e);
    } else {
      this.resetDragInterval();

      if (!this.actionStatus.mouseInfo) return;

      let distance = 0;
      let shiftLeft = false;
      if (e.clientX < left) {
        shiftLeft = true;
        distance = Math.abs(e.clientX - left);
      } else {
        shiftLeft = false;
        distance = Math.abs(e.clientX - right);
      }

      this.dragInterval = setInterval(() => {
        this.shift(distance, shiftLeft);
        let curTime = this.getIndicatorTime();
        let curDateIndex = new Date().getDate() - curTime.getDate();
        if (curDateIndex != this.state.dateIndex) {
          this.setState({
            dateIndex: curDateIndex,
          }, () => {
            this.draw();
          })
        }
      }, 300);
    }
  }

  moving(pos) {
    logger.debug('moving(), pos:', pos);
    if (!this.actionStatus.shifting || !this.actionStatus.mouseInfo) return;

    var prev = this.actionStatus.setMouseInfo(pos);

    var distance = TimelineUtil.calcDistance(this.actionStatus.mouseInfo, prev);
    this.shift(distance, this.actionStatus.mouseInfo.x < prev.x);
  }

  handleMouseUp(e) {
    logger.debug('handleMouseUp(), e:', e);
    e.preventDefault();
    logger.debug('handleMouseUp() -> moveEnd, this.hasMove:', this.hasMove);
    this.hasMove = false;
    let mouseMoveDistance = Math.sqrt(Math.pow((e.offsetX - this.mouseDownPosition[0]), 2) + Math.pow((e.offsetY - this.mouseDownPosition[1]), 2))
    this.moveEnd(e);
    logger.debug('handleMouseUp(), mouseMoveDistance:', mouseMoveDistance);
    if (mouseMoveDistance < 1) {
      this.handleClick(e);
    }
  }

  handleClick = (e) => {
    // e.preventDefault();
    logger.debug('handleClick(), e:', e);

    // 此处为单击事件要执行的代码
    const { timelineCount, selectedIndex } = this.props;
    logger.debug('handleClick(), e.offsetX:', e.offsetX, 'e.offsetY:', e.offsetY, 'timelineCount:', timelineCount, 'selectedIndex:', selectedIndex);
    // 判断点击位置 是否在时间轴上
    if (e.offsetY < TICK_HEIGHT || e.offsetY > TICK_HEIGHT + TIMELINE_HEIGHT * timelineCount) {
      return;
    } else {
      // 计算点击哪个时间轴
      let index = parseInt((e.offsetY - TICK_HEIGHT) / TIMELINE_HEIGHT);
      if (index != selectedIndex) {
        logger.log('handleClick() -> onSelectedTimelineChange, index:', index);
        !!this.props.onSelectedTimelineChange && this.props.onSelectedTimelineChange(index);
      }
    }
  }

  handleBlur(e) {
    logger.debug('handleBlur(), e:', e);
    this.moveEnd();
  }

  moveEnd(pos) {
    logger.debug('moveEnd(), pos:', pos);
    this.resetDragInterval();

    if (!this.actionStatus.shifting || !this.actionStatus.mouseInfo) return;

    if (pos) {
      var prev = this.actionStatus.setMouseInfo(pos);
      this.actionStatus.calcSpeed(prev);
    } else {
      this.actionStatus.calcSpeed(this.actionStatus.oldMouseInfo);
    }

    this.actionStatus.shifting = false;
    this.actionStatus.animating = true;
    this.actionStatus.mouseInfo = null;

    this.removeDocumentEvents();
    this.startAnimation();
  }

  handleMouseWheel(e) {
    let curIndex = MultipleTimeline.SpanArray.indexOf(this.state.span);
    logger.debug('handleMouseWheel(), e:', e, 'this.state.span:', this.state.span, 'curIndex:', curIndex, 'e.deltaY:', e.deltaY);
    if (e.deltaY < 0) {
      curIndex = Math.max(0, curIndex - 1);
    } else {
      curIndex = Math.min(curIndex + 1, MultipleTimeline.SpanArray.length - 1);
    }

    this.updateSpan(MultipleTimeline.SpanArray[curIndex]);
  }

  updateSpan(newSpan) {
    logger.debug('updateSpan(), newSpan:', newSpan);
    const timelineStartTime = this.getTimelineStartTime();
    const indicatorTime = this.getIndicatorTime();

    let indicatorDistance = this.timeToX(indicatorTime) - TIMELINE_INDEX_TEXT_WIDTH - LINE_WIDTH;

    // 由距离计算出相差时间
    const contentSize = this.getContentSize();
    const spanSetting = MultipleTimeline.SpanSetting[newSpan] || MultipleTimeline.SpanSetting['24h'];
    let timeDistance = indicatorDistance * spanSetting.totalTime / contentSize.width;

    // this.setSpan(newSpan, () => {
    //   const setting = MultipleTimeline.SpanSetting[newSpan];
    //   const s = new Date(indicatorTime.getTime() - setting.totalTime / 2);
    //   this.setStartTime(s);
    // });

    const s = new Date(indicatorTime.getTime() - timeDistance);
    this.setTimelineStartTime(s, newSpan);
  }

  shift(d, left) {
    logger.debug('shift(), d:', d, 'left:', left);
    const shiftPeriod = this.distanceToPeriod(d)
    let start = this.getTimelineStartTime()
    if (left) {
      start = new Date(start.getTime() + shiftPeriod)
    } else {
      start = new Date(start.getTime() - shiftPeriod)
    }

    this.setTimelineStartTime(start)
  }

  getContentSize() {
    const ret = {
      x: TIMELINE_INDEX_TEXT_WIDTH + LINE_WIDTH,
      y: 0,
      width: 0,
      height: 0
    }

    const canvasMain = this._canvasMain;
    if (canvasMain) {
      ret.width = canvasMain.width - TIMELINE_INDEX_TEXT_WIDTH + LINE_WIDTH
      ret.height = canvasMain.height
    }

    return ret
  }

  timeToX(time) {
    const contentSize = this.getContentSize()

    let t = time
    if (!(time instanceof Date)) {
      t = new Date(+time)
    }

    if (isNaN(t.getTime())) {
      throw 'Invalid Date object received'
    } else {
      return this.periodToDistance(
        t - this.getTimelineStartTime()) +
        contentSize.x
    }
  }

  xToTime(x) {
    const contentSize = this.getContentSize()
    logger.debug('xToTime(), contentSize:', contentSize)
    return new Date(this.distanceToPeriod(x - contentSize.x) +
      this.getTimelineStartTime().getTime())
  }

  periodToDistance(p) {
    const contentSize = this.getContentSize()
    const spanSetting = this.getSpanSetting()
    return p * contentSize.width / spanSetting.totalTime
  }

  distanceToPeriod(d) {
    const contentSize = this.getContentSize()
    const spanSetting = this.getSpanSetting()
    return d * spanSetting.totalTime / contentSize.width
  }

  getSpanSetting() {
    return MultipleTimeline.SpanSetting[this.state.span] || MultipleTimeline.SpanSetting['24h']
  }

  initStartTime() {
    logger.debug('initStartTime(), this.props.playtime:', this.props.playtime);
    this.setStartTime(this.props.playtime);
  }

  setStartTime(t, s, notify) {
    if (!t) return
    const { span } = this.state;

    this.setState({
      _startTime: t,
      span: s || span
    }, () => {
      this.tickShifting();
    });

    // if (notify && this.props.onTimeChangecb) {
    //   logger.log('setStartTime(), -> onStartTimeChange, this.state._startTime:', this.state._startTime, 't:', t);
    //   this.props.onTimeChangecb(this.state._startTime, this.getIndicatorTime());
    // }
  }

  setTimelineStartTime(t, s) {
    if (!t) return
    const { span } = this.state;
    const start = this.getTimelineStartTime()
    this.props.changeStartTime && this.props.changeStartTime(t, new Date(start.getTime() + s.totalTime));

    this.setState({
      timelineStartTime: t,
      span: s || span
    }, () => {
      this.draw();
    })
  }

  getStartTime() {
    return this.state._startTime
    // const spanSetting = this.getSpanSetting()
    // return new Date(this.state._startTime.getTime() -  spanSetting.totalTime / 2)
  }

  getTimelineStartTime() {
    return this.state.timelineStartTime;
  }

  getEndTime() {
    const spanSetting = this.getSpanSetting()
    const start = this.getTimelineStartTime()
    return new Date(start.getTime() + spanSetting.totalTime)
  }

  getTimelineEndTime() {
    const spanSetting = this.getSpanSetting()
    const start = this.getTimelineStartTime()
    return new Date(start.getTime() + spanSetting.totalTime)
  }

  getIndicatorTime() {
    // const spanSetting = this.getSpanSetting()
    // const start = this.getStartTime()
    // let indicatorTime = new Date(start.getTime() + spanSetting.totalTime / 2)
    // return indicatorTime;
    return this.state._startTime;
  }

  getOtherLayers() {
    return []
  }

  render() {
    const { timelineCount } = this.props;
    const self = this;
    const rootClass = classnames(styles.multipleTimeline, this.props.className);
    const canvasContainerStyle = classnames(styles.canvasContainer, { [styles.nine]: timelineCount == 9 });

    return (
      <div className={rootClass}>
        <div id="timeline-container" className={canvasContainerStyle}
          ref={c => this._container = c}
          // onClick={self.handleClick}
          onDoubleClick={self.handleDoubleClick}
          onMouseDown={self.handleMouseDown}
          onTouchStart={self.handleTouchStart}
          onBlur={self.handleBlur}
          onWheel={self.handleMouseWheel}
        >
          <canvas id="canvas_ticks" key="canvas_ticks"
            ref={c => this._canvasTicks = c}
          />
          <canvas id="canvas_bkg" key="canvas_bkg"
            ref={c => this._canvasBkg = c}
          />
          <canvas id="canvas_main" key="canvas_main"
            ref={c => this._canvasMain = c}
          />
          {this.state.show ?
            <canvas id="canvas_indicator" key="canvas_indicator"
              ref={c => this._canvasInd = c}
            /> : null
          }
          {this.getOtherLayers()}
        </div>
      </div>
      // </div>
    );
  }
}


MultipleTimeline.defaultProps = {
  timelineCount: 4,
};

export default MultipleTimeline;
