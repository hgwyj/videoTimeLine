import React from 'react';
import * as Rx from 'rxjs';
import * as _ from 'lodash';
import classnames from 'classnames';
import Tween from '@tweenjs/tween.js';
import moment from 'moment';
import TimelineUtil from './timeline-util'
import styles from './timeline.less'
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
    this.oldMouseInfo = this.mouseInfo;
    this.mouseInfo = TimelineUtil.getMouseInfo(e);
    return this.oldMouseInfo;
  }

  isMoveLeft() {
    if (this.mouseInfo.x === this.originMouseInfo.x) {
      return this.mouseInfo.y < this.originMouseInfo.y;
    } else {
      return this.mouseInfo.x < this.originMouseInfo.x;
    }
  }
  //计算速度
  calcSpeed(old) {
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

class TimeLine extends React.Component {
  static SpanArray = [
    '15m', '30m', '1h', '2h', '4h', '6h', '12h', '24h'
  ];
  static SpanSetting = {
    '15m': {
      totalTime: 900000,  // 总时长
      unitTime: 300000,   // 主刻度间隔
      subTicks: 5,        // 辅刻度个数
      minorTicks: 2       // 小刻度个数 小刻度个数
    },
    '30m': {
      totalTime: 1800000,
      unitTime: 600000,
      subTicks: 2,
      minorTicks: 5
    },
    '1h': {
      totalTime: 3600000,
      unitTime: 1200000,
      subTicks: 2,
      minorTicks: 5
    },
    '2h': {
      totalTime: 7200000,
      unitTime: 1800000,
      subTicks: 3,
      minorTicks: 5
    },
    '4h': {
      totalTime: 14400000,
      unitTime: 3600000,
      subTicks: 4,
      minorTicks: 5
    },
    '6h': {
      totalTime: 21600000,
      unitTime: 7200000,
      subTicks: 4,
      minorTicks: 6
    },
    '12h': {
      totalTime: 43200000,
      unitTime: 10800000,
      subTicks: 3,
      minorTicks: 4
    },
    '24h': {
      totalTime: 86400000,
      unitTime: 14400000,
      subTicks: 4,
      minorTicks: 4
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
    if (!this.actionStatus.shifting && nextProps.startTime) {
      console.log('timeline componentWillReceiveProps', nextProps.startTime);
      this.setStartTime(nextProps.startTime);
    }

    if (nextProps.span) {
      this.updateSpan(nextProps.span);
    }

    this.tickShifting();
  }
  setSpan(span, cb) {
    if (this.state.span !== span) {
      this.setState({
        span
      }, () => {
        if (!!cb) cb();
        this.tickShifting()
      });
    }
  }

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
    this.mouseMoveObserver = Rx.Observable.fromEvent(document, 'mousemove')
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
    const self = this;

    if (self.actionStatus.animating) {
      self.actionStatus.animating = false;

      if (!self.actionStatus.shifting && self.props.onTimeChangecb) {
        this.props.onTimeChangecb(
          self.getStartTime(), self.getIndicatorTime());
      }
      //self.tickAnimation();
    } else if (self.actionStatus.shifting) {
      self.tickShifting();
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

  tickAnimation(timestamp) {
    const self = this;
    function anim() {
      if (!self.actionStatus.animating) return;

      requestAnimationFrame(anim);
      Tween.update();
    }

    const s = { speed: self.actionStatus.speed };
    console.log(self.actionStatus.speed);
    const tween = new Tween.Tween(s)
      .to({ speed: 0 }, 300)
      .easing(Tween.Easing.Quadratic.Out)
      .onUpdate(() => {
        self.shift(Math.abs(s.speed), s.speed > 0);
      })
      .onComplete(() => {
        self.actionStatus.animating = false;

        if (!self.actionStatus.shifting && self.props.onTimeChangecb) {
          this.props.onTimeChangecb(
            self.getStartTime(), self.getIndicatorTime());
        }
      })
      .start();

    anim();
  }

  draw() {
    this.drawTicks()
    this.drawBkg()
    this.drawMain()
    this.drawIndicator()
  }

  //进行属性的更新
  getTickStyle() {
    let tickStyle = {
      font: '12px 微软雅黑',
      textAlign: 'center',
      textBaseline: 'top',
      textColor: 'rgb(49, 89, 154)',
      mainHeight: 19,
      mainWidth: 2,
      mainColor: 'rgb(49, 89, 154)',
      subHeight: 17,
      subWidth: 1,
      subColor: 'rgb(49, 89, 154)',
      minorHeight: 9,
      minorWidth: 1,
      minorColor: 'rgb(42, 89, 83)'
    }

    return _.assign(tickStyle, this.props.tickStyle);
  }

  drawTicks() {
    const canvas = this._canvasTicks
    if (!canvas) return

    const width = canvas.width
    const height = canvas.height
    const ctx = canvas.getContext('2d')

    ctx.clearRect(0, 0, width, height)
    ctx.save()

    const spanSetting = this.getSpanSetting()
    const subUnit = spanSetting.unitTime / spanSetting.subTicks
    const minorUnit = subUnit / spanSetting.minorTicks
    const start = this.getStartTime()
    const end = this.getEndTime()

    const times = TimelineUtil.getTicks(
      start, end, spanSetting.unitTime, subUnit, minorUnit)

    const tickStyle = this.getTickStyle()

    ctx.font = tickStyle.font
    ctx.textAlign = tickStyle.textAlign
    ctx.textBaseline = tickStyle.textBaseline

    var context = this;
    times.forEach(function (t) {
      const strTime = moment(t.time).format('HH:mm');
      let timeX = context.timeToX(t.time)

      let lineHeight = 19
      let lineWidth = 1
      let lineColor = 'rgb(49, 89, 154)'
      let drawText = false
      if (t.type === 'main') {
        lineHeight = tickStyle.mainHeight
        lineWidth = tickStyle.mainWidth
        lineColor = tickStyle.mainColor
        drawText = true
      } else if (t.type === 'sub') {
        lineHeight = tickStyle.subHeight
        lineWidth = tickStyle.subWidth
        lineColor = tickStyle.subColor
      } else if (t.type === 'minor') {
        lineHeight = tickStyle.minorHeight
        lineWidth = tickStyle.minorWidth
        lineColor = tickStyle.minorColor
      }

      ctx.beginPath()
      ctx.moveTo(timeX, height - 1)
      ctx.lineTo(timeX, height - 1 - lineHeight)
      ctx.strokeStyle = lineColor
      ctx.lineWidth = lineWidth
      ctx.stroke()

      if (drawText) {
        const textWidth = ctx.measureText(strTime).width
        if (timeX - textWidth / 2 < 0) {
          timeX = textWidth / 2
        } else if (timeX + textWidth / 2 > width) {
          timeX = width - textWidth / 2
        }

        ctx.beginPath()
        ctx.fillStyle = tickStyle.textColor
        ctx.fillText(strTime, timeX, 0)
      }
    })

    ctx.restore()
  }
  //画出时间线的背景
  drawBkg() {
    const canvas = this._canvasBkg
    if (!canvas) return

    const width = canvas.width
    const height = canvas.height
    const ctx = canvas.getContext('2d')
    ctx.clearRect(0, 0, width, height)
    ctx.save()

    const maskWidth = 200;
    const maskHeight = 14;
    const maskleft = (width - maskWidth) / 2;
    var my_gradient = ctx.createLinearGradient(maskleft, 0, maskleft + maskWidth, 0);
    my_gradient.addColorStop(0, "rgba(22,19,33,0.2)");
    my_gradient.addColorStop(0.3, "rgba(22,19,33,1)");
    my_gradient.addColorStop(0.7, "rgba(22,19,33,1)");
    my_gradient.addColorStop(1, "rgba(22,19,33,0.2)");
    ctx.fillStyle = my_gradient;
    ctx.fillRect(maskleft, 0, maskWidth, maskHeight);

    ctx.restore()
  }

  drawMain() {
    const files = this.props.files
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
      ctx.moveTo(start, height - 1)
      ctx.lineTo(start, height - 1 - 17)
      ctx.lineTo(end, height - 1 - 17)
      ctx.lineTo(end, height - 1)
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
    console.log('time', time);
    console.log('time2', time2);
    return time == time2;
  }

  drawIndicator() {
    const canvas = this._canvasInd
    if (!canvas) return

    const spanSetting = this.getSpanSetting()

    const width = canvas.width
    const height = canvas.height
    const ctx = canvas.getContext('2d')

    ctx.clearRect(0, 0, width, height)
    ctx.save()

    const middle = this.getIndicatorTime();
    var flag = this.compareTime(middle);
    var midstr;
    if (flag) {
      midstr = moment(middle).format('HH:mm:ss');
    } else {
      midstr = moment(middle).format('YYYY-MM-DD HH:mm:ss');
    }
    const middleX = width / 2

    ctx.beginPath()
    ctx.moveTo(middleX, height)
    ctx.lineTo(middleX, height - 21)
    ctx.strokeStyle = 'rgb(188, 78, 174)'
    ctx.lineWidth = 2
    ctx.stroke()

    ctx.font = '12px 微软雅黑'
    ctx.textAlign = 'center'

    ctx.beginPath()
    ctx.fillStyle = 'rgb(188, 78, 174)'
    ctx.fillText(midstr, middleX, 12);

    ctx.restore()
  }

  getAllCanvas() {
    return [
      this._canvasInd, this._canvasMain,
      this._canvasBkg, this._canvasTicks
    ]
  }

  handleResize(e) {
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
    const info = TimelineUtil.convertTouchInfo(e);
    this.moveStart(info);

    this.addDocumentTouchEvents();
  }

  handleTouchMove(e) {
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
    this.moveEnd();
  }

  handleDoubleClick(e) {
    console.log(e);
    e.preventDefault();
  }

  handleMouseDown(e) {
    e.stopPropagation();
    e.preventDefault();
    this.moveStart(e);
    this.addDocumentMouseEvents();
  }

  moveStart(pos) {
    this.resetDragInterval();

    this.actionStatus.setMouseInfo(pos);
    this.actionStatus.originMouseInfo = this.actionStatus.mouseInfo;
    this.actionStatus.oldMouseInfo = null;
    this.actionStatus.shifting = true;
    this.actionStatus.animating = false;
  }

  handleMouseMove(e) {
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
      }, 300);
    }
  }

  moving(pos) {
    if (!this.actionStatus.shifting || !this.actionStatus.mouseInfo) return;

    var prev = this.actionStatus.setMouseInfo(pos);

    var distance = TimelineUtil.calcDistance(this.actionStatus.mouseInfo, prev);
    this.shift(distance, this.actionStatus.mouseInfo.x < prev.x);
  }

  handleMouseUp(e) {
    e.preventDefault();
    this.moveEnd(e);
  }

  handleBlur(e) {
    this.moveEnd();
  }

  moveEnd(pos) {
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
    let curIndex = TimeLine.SpanArray.indexOf(this.state.span);
    if (e.deltaY < 0) {
      curIndex = Math.max(0, curIndex - 1);
    } else {
      curIndex = Math.min(curIndex + 1, TimeLine.SpanArray.length - 1);
    }

    this.updateSpan(TimeLine.SpanArray[curIndex], e.clientX);
  }

  updateSpan(newSpan, mouseX) {
    const indicatorTime = this.getIndicatorTime();

    this.setSpan(newSpan, () => {
      const setting = TimeLine.SpanSetting[newSpan];
      const s = new Date(indicatorTime.getTime() - setting.totalTime / 2);
      this.setStartTime(s);
    });
  }

  shift(d, left) {
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
    console.log('xToTime', contentSize)
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
    return TimeLine.SpanSetting[this.state.span] || TimeLine.SpanSetting['4h']
  }

  initStartTime() {
    this.setStartTime(this.props.startTime);
  }

  setStartTime(t) {
    if (!t) return
    console.log('timeline setStartTime', t);
    if (!this.state._startTime || this.state._startTime.getTime() !== t.getTime()) {
      const oldStart = this.state._startTime;

      this.setState({
        _startTime: t
      }, () => {
        setTimeout(() => {
          this.tickShifting();
          if (this.props.onStartTimeChange) {
            console.log('timeline setStartTime onStartTimeChange', this.state._startTime, t);
            this.props.onStartTimeChange(oldStart, this.state._startTime)
          }
        }, 0);
      });
    }
  }

  getStartTime() {
    return this.state._startTime
  }

  setEndTime(t) {
    if (!t) return

    const spanSetting = this.getSpanSetting()
    const start = new Date(t.getTime() - spanSetting.totalTime)
    this.setStartTime(start)
  }

  getEndTime() {
    const spanSetting = this.getSpanSetting()
    const start = this.getStartTime()
    return new Date(start.getTime() + spanSetting.totalTime)
  }

  getIndicatorTime() {
    const spanSetting = this.getSpanSetting()
    const start = this.getStartTime()
    return new Date(start.getTime() + spanSetting.totalTime / 2)
  }

  getOtherLayers() {
    return []
  }

  render() {
    const self = this;
    const rootClass = classnames(styles.timeline, this.props.className);

    return (
      <div id="timeline-container" className={rootClass}
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
    );
  }
}

export default TimeLine;
