import React from 'react';
import * as Rx from 'rxjs';
import * as _ from 'lodash';
import classnames from 'classnames';
import Tween from '@tweenjs/tween.js';
import moment from 'moment';
import TimelineUtil from './timeline-util'
import styles from './timeline.less'
import Logger from 'log4jkjs';
import { Button } from 'antd';

// 创建日志管理
let logger = new Logger("/TimeLine/DateTimeLine.jsx [DateTimeLine]");
logger.config('LOG', 'black', 'console');
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
    logger.log('setMouseInfo()');
    this.oldMouseInfo = this.mouseInfo;
    this.mouseInfo = TimelineUtil.getMouseInfo(e);
    return this.oldMouseInfo;
  }

  isMoveLeft() {
    logger.log('isMoveLeft()');
    if (this.mouseInfo.x === this.originMouseInfo.x) {
      return this.mouseInfo.y < this.originMouseInfo.y;
    } else {
      return this.mouseInfo.x < this.originMouseInfo.x;
    }
  }
  //计算速度
  calcSpeed(old) {
    logger.log('calcSpeed(), old:', old);
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

class DateTimeLine extends React.Component {
  static SpanArray = [
    '15m', '30m', '1h', '2h', '4h', '6h', '12h', '24h'
  ];
  static SpanSetting = {
    '15m': {
      totalTime: 900000,  // 总时长
      unitTime: 300000,   // 主刻度间隔 5m
      minorTicks: 5       // 小刻度个数 1m
    },
    '30m': {
      totalTime: 1800000,
      unitTime: 600000, // 10m
      minorTicks: 5 // 2m
    },
    '1h': {
      totalTime: 3600000,
      unitTime: 1200000, // 20m
      minorTicks: 4 // 5m
    },
    '2h': {
      totalTime: 7200000,
      unitTime: 1800000, // 30m
      minorTicks: 6 // 5m
    },
    '4h': {
      totalTime: 14400000,
      unitTime: 3600000, // 1h
      minorTicks: 6 // 10m
    },
    '6h': {
      totalTime: 21600000,
      unitTime: 7200000, // 2h
      minorTicks: 6 // 20m
    },
    '12h': {
      totalTime: 43200000,
      unitTime: 10800000, // 3h
      minorTicks: 6 // 30m
    },
    '24h': {
      totalTime: 86400000,
      unitTime: 14400000, // 8h
      minorTicks: 4 // 2h
    },
  }
  constructor(props) {
    super(props);
    this.state = {
      span: props.defaultSpan || '1h',
      _startTime: new Date(),
      show: true,
    };
    this.actionStatus = new ActionStatus();
    this.rightDate = moment().subtract(1, 'days');

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

    if (this.props.onCreated) {
      this.props.onCreated(this);
    }
  }

  componentWillReceiveProps(nextProps) {
    if (!this.actionStatus.shifting && this.state._startTime.getTime() != nextProps.startTime.getTime()) {
      logger.log('componentWillReceiveProps(), this.state._startTime:', this.state._startTime, 'nextProps.startTime:', nextProps.startTime);
      this.setStartTime(nextProps.startTime);
    }
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
  }

  //清除定时器功能
  resetDragInterval() {
    if (this.dragInterval) {
      clearInterval(this.dragInterval);
      this.dragInterval = null;
    }
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
      if (!this.actionStatus.shifting && this.props.onTimeChangecb) {
        logger.log('startAnimation(), this.getStartTime():', this.getStartTime(), 'this.getIndicatorTime():', this.getIndicatorTime());
        this.props.onTimeChangecb(
          this.getStartTime(), this.getIndicatorTime());
      }
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
    logger.log('draw()');
    this.drawMain()
    this.drawTicks()
    this.drawIndicator()
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
    logger.log('drawTicks()');
    const canvas = this._canvasTicks
    if (!canvas) return

    const width = canvas.width
    const height = canvas.height
    const ctx = canvas.getContext('2d')

    ctx.clearRect(0, 0, width, height)
    ctx.save()

    const spanSetting = this.getSpanSetting()
    const minorUnit = spanSetting.unitTime / spanSetting.minorTicks
    const start = this.getStartTime()
    const end = this.getEndTime()

    const times = TimelineUtil.getDateTimeLineTicks(
      start, end, spanSetting.unitTime, minorUnit)

    logger.log('getDateTimeLineTicks(), times:', times);

    const tickStyle = this.getTickStyle()
    ctx.font = tickStyle.font
    ctx.textAlign = tickStyle.textAlign
    ctx.textBaseline = tickStyle.textBaseline

    var context = this;
    times.forEach(function (t) {
      // logger.log('drawTicks(), t:', t, 'tickStyle:', tickStyle, 'width:', width, 'height:', height);
      const strTime = moment(t.time).format('HH:mm');
      let timeX = context.timeToX(t.time)

      let lineWidth = 1
      let lineColor = 'rgb(49, 89, 154)'
      let drawText = false
      if (t.type === 'main') {
        lineWidth = tickStyle.mainWidth
        lineColor = tickStyle.mainColor
        ctx.beginPath()
        ctx.moveTo(timeX, height * 0.2)
        ctx.lineTo(timeX, height * 0.8)
        ctx.strokeStyle = lineColor
        ctx.lineWidth = lineWidth
        ctx.stroke()
        drawText = true
      } else if (t.type === 'minor') {
        lineWidth = tickStyle.minorWidth
        lineColor = tickStyle.minorColor
        ctx.beginPath()
        ctx.moveTo(timeX, height * 0.3)
        ctx.lineTo(timeX, height * 0.7)
        ctx.strokeStyle = lineColor
        ctx.lineWidth = lineWidth
        ctx.stroke()
      }

      if (drawText) {
        const textWidth = ctx.measureText(strTime).width
        // logger.log('drawTicks(), textWidth:', textWidth, 'timeX:', timeX);
        if (timeX - textWidth / 2 < 0) {
          timeX = textWidth / 4 * 3
        } else if (timeX + textWidth / 2 > width) {
          timeX = width + textWidth / 4 * 3
        } else {
          timeX = timeX + textWidth / 4 * 3
        }

        ctx.beginPath()
        ctx.fillStyle = tickStyle.textColor
        ctx.fillText(strTime, timeX, height - 18)
      }
    })

    ctx.restore()
  }

  drawMain() {
    logger.log('drawMain()');
    const files = this.props.files;
    if (!files || files.length <= 0) return

    const canvas = this._canvasMain
    if (!canvas) return

    const width = canvas.width
    const height = canvas.height
    const ctx = canvas.getContext('2d')

    ctx.clearRect(0, 0, width, height)
    ctx.save()

    var context = this;
    files.forEach(function (f) {
      const start = context.timeToX(f.start)
      const end = context.timeToX(f.end)

      if (end <= 0 || start >= width) return

      ctx.beginPath()
      ctx.moveTo(start, 0)
      ctx.lineTo(start, height)
      ctx.lineTo(end, height)
      ctx.lineTo(end, 0)
      ctx.closePath();

      ctx.fillStyle = 'rgba(3, 123, 221, 0.3)'
      ctx.fill()
    })

    ctx.restore()
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
    logger.log('drawIndicator()');
    const { model } = this.props;
    const canvas = this._canvasInd
    if (!canvas) return

    const spanSetting = this.getSpanSetting()

    const width = canvas.width
    const height = canvas.height

    const ctx = canvas.getContext('2d')

    ctx.clearRect(0, 0, width, height)
    ctx.save()

    const middle = this.getIndicatorTime();
    logger.log('drawIndicator(), middle:', middle);
    var flag = this.compareTime(middle);
    var midstr;
    if (flag) {
      midstr = moment(middle).format('HH:mm:ss');
    } else {
      midstr = moment(middle).format('YYYY-MM-DD HH:mm:ss');
    }
    logger.log('drawIndicator(), midstr:', midstr);
    const middleX = width / 2

    ctx.beginPath()
    ctx.moveTo(middleX - 6, height)
    ctx.lineTo(middleX + 6, height)
    ctx.lineTo(middleX, height - 6)
    ctx.closePath();

    ctx.fillStyle = 'rgba(252, 87, 31, 1)'
    ctx.fill()

    ctx.beginPath()
    ctx.moveTo(middleX, height - 5)
    ctx.lineTo(middleX, 0);
    ctx.strokeStyle = 'rgb(252, 87, 31)'
    ctx.lineWidth = 2
    ctx.stroke()

    ctx.font = '12px 微软雅黑'
    ctx.textAlign = 'center'

    this.offLeftWidth = ctx.measureText(midstr).width / 2 + 5;

    ctx.fillStyle = 'rgba(22,19,33,1)';
    ctx.fillRect(middleX + 5, 2, ctx.measureText(midstr).width + 2, 15);

    ctx.beginPath()
    ctx.fillStyle = 'rgb(168, 168, 168)'
    ctx.fillText(midstr, middleX + this.offLeftWidth, 14);

    ctx.restore()
  }

  getAllCanvas() {
    logger.log('getAllCanvas()');
    return [
      this._canvasInd, this._canvasMain,
      // this._canvasBkg,
      this._canvasTicks,
      this._canvasDates,
    ]
  }

  handleResize(e) {
    logger.log('handleResize()');
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
    logger.log('handleTouchStart(), e:', e);
    const info = TimelineUtil.convertTouchInfo(e);
    this.moveStart(info);

    this.addDocumentTouchEvents();
  }

  handleTouchMove(e) {
    logger.log('handleTouchMove(), e:', e);
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
    logger.log('handleTouchEnd(), e:', e);
    this.moveEnd();
  }

  handleDoubleClick(e) {
    logger.log('handleDoubleClick(), e:', e);
    e.preventDefault();
  }

  handleMouseDown(e) {
    logger.log('handleMouseDown(), e:', e, 'e.nativeEvent.offsetX:', e.nativeEvent.offsetX, 'e.nativeEvent.offsetY:', e.nativeEvent.offsetY);
    e.stopPropagation();
    e.preventDefault();

    this.hasMove = true;
    logger.log('handleMouseDown(), move, this.hasMove:', this.hasMove);
    this.moveStart(e);

    this.addDocumentMouseEvents();
  }

  moveStart(pos) {
    logger.log('moveStart(), pos:', pos);
    this.resetDragInterval();

    this.actionStatus.setMouseInfo(pos);
    this.actionStatus.originMouseInfo = this.actionStatus.mouseInfo;
    this.actionStatus.oldMouseInfo = null;
    this.actionStatus.shifting = true;
    this.actionStatus.animating = false;
  }

  handleMouseMove(e) {
    this.hasMove = true;
    logger.log('handleMouseMove(), e:', e);
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
    logger.log('moving(), pos:', pos);
    if (!this.actionStatus.shifting || !this.actionStatus.mouseInfo) return;

    var prev = this.actionStatus.setMouseInfo(pos);

    var distance = TimelineUtil.calcDistance(this.actionStatus.mouseInfo, prev);
    this.shift(distance, this.actionStatus.mouseInfo.x < prev.x);
  }

  handleMouseUp(e) {
    logger.log('handleMouseUp(), e:', e);
    e.preventDefault();
    logger.log('handleMouseUp() -> moveEnd, this.hasMove:', this.hasMove);
    this.hasMove = false;
    this.moveEnd(e);
  }

  handleBlur(e) {
    logger.log('handleBlur(), e:', e);
    this.moveEnd();
  }

  moveEnd(pos) {
    logger.log('moveEnd(), pos:', pos);
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
    let curIndex = DateTimeLine.SpanArray.indexOf(this.state.span);
    logger.log('handleMouseWheel(), e:', e, 'this.state.span:', this.state.span, 'curIndex:', curIndex, 'e.deltaY:', e.deltaY);
    if (e.deltaY < 0) {
      curIndex = Math.max(0, curIndex - 1);
    } else {
      curIndex = Math.min(curIndex + 1, DateTimeLine.SpanArray.length - 1);
    }

    this.updateSpan(DateTimeLine.SpanArray[curIndex]);
  }

  updateSpan(newSpan) {
    logger.log('updateSpan(), newSpan:', newSpan);
    const indicatorTime = this.getIndicatorTime();

    // this.setSpan(newSpan, () => {
    //   const setting = DateTimeLine.SpanSetting[newSpan];
    //   const s = new Date(indicatorTime.getTime() - setting.totalTime / 2);
    //   this.setStartTime(s);
    // });


    const setting = DateTimeLine.SpanSetting[newSpan];
    const s = new Date(indicatorTime.getTime() - setting.totalTime / 2);
    this.setStartTime(s, newSpan);
  }

  shift(d, left) {
    logger.log('shift(), d:', d, 'left:', left);
    const shiftPeriod = this.distanceToPeriod(d)
    let start = this.getStartTime()
    if (left) {
      start = new Date(start.getTime() + shiftPeriod)
    } else {
      start = new Date(start.getTime() - shiftPeriod)
    }

    this.setStartTime(start)
  }

  getContentSize() {
    const ret = {
      x: 0,
      y: 0,
      width: 0,
      height: 0
    }

    const canvas = this._canvasMain;
    if (canvas) {
      ret.width = canvas.width
      ret.height = canvas.height
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
        t - this.getStartTime()) +
        contentSize.x
    }
  }

  xToTime(x) {
    const contentSize = this.getContentSize()
    logger.log('xToTime(), contentSize:', contentSize)
    return new Date(this.distanceToPeriod(x - contentSize.x) +
      this.getStartTime().getTime())
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
    return DateTimeLine.SpanSetting[this.state.span] || DateTimeLine.SpanSetting['4h']
  }

  initStartTime() {
    logger.log('initStartTime(), this.props.startTime:', this.props.startTime);
    this.setStartTime(this.props.startTime);
  }

  setStartTime(t, s, notify) {
    if (!t) return
    const { span } = this.state;
    logger.log('setStartTime(), t', t);
    // logger.log('setStartTime(), !this.state._startTime:', !this.state._startTime, 'this.state._startTime.getTime() !== t.getTime():', this.state._startTime.getTime() !== t.getTime());
    //if (!this.state._startTime || this.state._startTime.getTime() !== t.getTime()) {
    //logger.log('setStartTime(), this.setState({_startTime})');

    this.setState({
      _startTime: t,
      span: s || span
    }, () => {
      setTimeout(() => {
        this.tickShifting();
        if (notify && this.props.onTimeChangecb) {
          logger.log('setStartTime(), -> onStartTimeChange, this.state._startTime:', this.state._startTime, 't:', t);
          this.props.onTimeChangecb(this.state._startTime, this.getIndicatorTime());
        }
      }, 0);
    });

    //}
  }

  getStartTime() {
    return this.state._startTime
  }

  getEndTime() {
    const spanSetting = this.getSpanSetting()
    const start = this.getStartTime()
    return new Date(start.getTime() + spanSetting.totalTime)
  }

  getIndicatorTime() {
    const spanSetting = this.getSpanSetting()
    const start = this.getStartTime()
    let indicatorTime = new Date(start.getTime() + spanSetting.totalTime / 2)
    logger.log('getIndicatorTime(), spanSetting:', spanSetting, 'start:', start, 'indicatorTime:', indicatorTime);
    return indicatorTime;
  }

  getOtherLayers() {
    return []
  }

  // 创建单个日期 dom
  createDateDom(text, time, selected = false) {
    return (
      <div
        className={classnames(styles.dateDiv, { [styles.selected]: selected })}
        onClick={() => this.onClickDate(time, selected)}
      >
        {text}
      </div>
    )
  }

  onClickDate = (time, selected) => {
    if (selected) {
      return;
    } else if (!time) {
      !!this.props.onMoreDate && this.props.onMoreDate();
    } else {
      //logger.log('onClickDate(), time:', time, 'moment(time).format(MM/D HH:mm:ss):', moment(time).format('MM/D HH:mm:ss'), 'new Date(time):', new Date(time));
      //logger.log('onClickDate(), new Date(time - time % (1000 * 60 * 60 * 24) - 1000 * 60 * 60 * 8):', new Date(time - time % (1000 * 60 * 60 * 24) - 1000 * 60 * 60 * 8));

      this.setStartTime(new Date(time.format('YYYY-MM-DD 00:00:00')), '24h', true);
      // this.setState({
      //   _startTime: new Date(time.format('YYYY-MM-DD 00:00:00')),
      //   span: '24h',
      // }, () => {
      //   !!this.props.onTimeChangecb && this.props.onTimeChangecb(this.getStartTime(), this.getIndicatorTime());
      // });
    }
  }

  // 创建选择日期 dom
  createDatesDom(rightDate, amount) {

    let datesDom = [];

    const indicatorTimeDate = moment(this.getIndicatorTime()).format('MM/D');

    // let dateDistance = parseInt(new Date().getTime() - rightDate._d.getTime()) / (1000 * 60 * 60 * 24);
    // logger.log('createDatesDom(), dateDistance:', dateDistance);

    datesDom.push(this.createDateDom('更多', null, false));


    for (let i = 0; i < amount; i++) {
      let time = moment(rightDate).subtract(amount - i - 1, 'days');
      let iDate = time.format('MM/D');
      let selected = iDate == indicatorTimeDate;
      let dateDom = this.createDateDom(iDate, time, selected);
      datesDom.push(dateDom);
    }
    //logger.log('createDatesDom(), moment(new Date()).format(MM/D):', moment(new Date()).format('MM/D'));
    datesDom.push(this.createDateDom('今日', moment(), indicatorTimeDate == moment().format('MM/D')));
    return datesDom;
  }

  // onChangeDate = (date, dateString) => {
  //   this.setState({
  //     _startTime: new Date(date._d.getTime() - date._d.getTime() % (1000 * 60 * 60 * 24) - 1000 * 60 * 60 * 8),
  //     span: '24h',
  //   }, () => {
  //     !!this.props.onTimeChangecb && this.props.onTimeChangecb(this.getStartTime(), this.getIndicatorTime());
  //   });
  // }

  render() {
    const self = this;
    const rootClass = classnames(styles.dateTimeLine, this.props.className);

    // 计算 indicatorTime 所在日期

    let curDate = moment(this.getIndicatorTime());
    var diffdays = curDate.hours(0).minutes(0).seconds(0).milliseconds(0).diff(this.rightDate.hours(0).minutes(0).seconds(0).milliseconds(0), 'days');
    if (diffdays <= -6 || diffdays > 0) {
      this.rightDate = curDate;
    }

    if (this.rightDate.isAfter(moment().subtract(1, 'days'), 'days')) {
      this.rightDate = moment().subtract(1, 'days');
    }


    // let dateDistance = moment().diff(moment(this.getIndicatorTime()), 'days') // 1
    // //let dateDistance = parseInt((new Date(moment().format('YYYY-MM-DD 00:00:00')).getTime() - new Date(moment(this.getIndicatorTime()).format('YYYY-MM-DD 00:00:00')).getTime()) / (1000 * 60 * 60 * 24));
    // if (  dateDistance - this.dateDistance >= 6 ||
    //     ( dateDistance - this.dateDistance <= -1 && new Date(moment(this.getIndicatorTime().getTime()).format('YYYY-MM-DD 00:00:00')).getTime() < new Date(moment().format('YYYY-MM-DD 00:00:00')).getTime())) {
    //   this.dateDistance = dateDistance;
    // }
    return (
      <div className={rootClass}>
        {/* <div className={styles.dateContainerOut}> */}
        <div className={styles.dateContainer}>
          {this.createDatesDom(this.rightDate, 6)}
        </div>
        <div className={styles.HLine}></div>
        {/* </div> */}
        {/* <div className={styles.canvasContainerOut}> */}
        <div id="timeline-container" className={styles.canvasContainer}
          ref={c => this._container = c}
          onClick={self.props.onClick}
          onDoubleClick={self.props.onDoubleClick}
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

export default DateTimeLine;
