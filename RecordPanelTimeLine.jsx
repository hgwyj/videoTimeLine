import React from 'react';
import * as Rx from 'rxjs';
import TimeLine from './timeline';

class RecordPanelTimeLine extends TimeLine {

  static defaultProps = {
    show: true
  }

  constructor(props) {
    super(props);
    this._dragStatus = ''
    this._prevDrag = null
    this.state = {
      _selStart: null,
      _selEnd: null,
      span: props.defaultSpan || '4h',
      _startTime: new Date(),
    }

    this.handleWinMouseMove = this.handleWinMouseMove.bind(this)
    this.dragging = this.dragging.bind(this);
    this.postDrag = this.postDrag.bind(this);
  }

  componentDidMount() {
    super.componentDidMount()
    window.addEventListener('mousemove', this.handleWinMouseMove)

    if (this.props.selStart) {
      console.log('TimeLint/RecordPanelTimeLine => conponentDidMount(), this.props.selStart:', this.props.selStart);
      this.setState({ _selStart: new Date(this.props.selStart) });
    }

    if (this.props.selEnd) {
      console.log('TimeLint/RecordPanelTimeLine => conponentDidMount(), this.props.selEnd:', this.props.selEnd);
      this.setState({ _selEnd: new Date(this.props.selEnd) });
    }
    super.setIndicator && super.setIndicator(this.props.show);
  }

  componentWillUnmount() {
    super.componentWillUnmount()
    window.removeEventListener('mousemove', this.handleWinMouseMove)
    this.removeDragObserver()
    this.resetDragSelInterval()
  }

  componentWillReceiveProps(nextProps) {
    if (this._dragStatus === '') {
      if (nextProps.selStart) {
        console.log('TimeLint/RecordPanelTimeLine => componentWillReceiveProps(), this.props.selStart:', this.props.selStart);
        this.setState({ _selStart: new Date(nextProps.selStart) });
      }

      if (nextProps.selEnd) {
        console.log('TimeLint/RecordPanelTimeLine => componentWillReceiveProps(), this.props.selEnd:', this.props.selEnd);
        this.setState({ _selEnd: new Date(nextProps.selEnd) });
      }
    }

    super.componentWillReceiveProps(nextProps)
  }

  toClientCoordX(x) {
    if (!x) {
      return 0;
    } else {
      return x - this._container.getBoundingClientRect().left;
    }
  }

  preDrag(e) {
    const x = this.toClientCoordX(e.clientX || e.targetTouches[0].clientX)

    this._dragStatus = ''
    this._prevDrag = null

    const start = this.state._selStart ? this.timeToX(this.state._selStart) : 0
    const end = this.state._selEnd ? this.timeToX(this.state._selEnd) : 0
    const delta = 15

    const dragPoints = [start, end]
    const dragStatus = ['dragStart', 'dragEnd']

    if (start <= x && x <= end) {
      this._dragStatus = 'dragMain'
    }

    if (x - start >= 0 && x - start <= delta) {
      this._dragStatus = 'dragStart';
    }

    if (end - x >= 0 && end - x <= delta) {
      this._dragStatus = 'dragEnd';
    }

    // for (let i = 0; i < dragPoints.length; i++) {
    //   const dp = dragPoints[i]
    //   if (dp === 0) continue

    //   if (Math.abs(x - dp) <= delta) {
    //     this._dragStatus = dragStatus[i]
    //     break;
    //   }
    // }

    if (this._dragStatus !== '') {
      this._prevDrag = x

      e.preventDefault()
      e.stopPropagation()
    }
  }

  removeDragObserver() {
    if (this.dragMoveObserver) {
      this.dragMoveObserver.unsubscribe();
      this.dragMoveObserver = null;
    }

    if (this.dragPostObserver) {
      this.dragPostObserver.unsubscribe();
      this.dragPostObserver = null;
    }

    if (this.dragTouchMoveObserver) {
      this.dragTouchMoveObserver.unsubscribe();
      this.dragTouchMoveObserver = null;
    }

    if (this.dragTouchPostObserver) {
      this.dragTouchPostObserver.unsubscribe();
      this.dragTouchPostObserver = null;
    }
  }

  handleMouseDown(e) {
    this.preDrag(e)
    if (this._dragStatus !== '') {
      this.dragMoveObserver = Rx.Observable.fromEvent(document, 'mousemove')
        .subscribe(this.dragging);
      this.dragPostObserver = Rx.Observable.fromEvent(document, 'mouseup')
        .subscribe(this.postDrag);
    } else {
      super.handleMouseDown(e)
    }
  }

  ensureDragVisible(start) {
    const s = this.getStartTime()
    const e = this.getEndTime()

    if (start) {
      if (this.state._selStart.getTime() < s.getTime()) {
        this.setStartTime(this.state._selStart)
      } else if (this.state._selStart.getTime() > e.getTime()) {
        this.setEndTime(this.state._selStart)
      }
    } else {
      if (this.state._selEnd.getTime() > e.getTime()) {
        this.setEndTime(this.state._selEnd)
      } else if (this.state._selEnd.getTime() < s.getTime()) {
        this.setStartTime(this.state._selEnd)
      }
    }
  }

  resetDragSelInterval() {
    if (this.dragSelInterval) {
      clearInterval(this.dragSelInterval);
      this.dragSelInterval = null;
    }
  }

  dragging(e) {
    e.preventDefault()
    e.stopPropagation()

    const x = e.clientX || e.targetTouches[0].clientX;
    const { left, right } = this._containerRect;
    if (left <= x && x <= right) {
      this.resetDragSelInterval();

      const tempX = this.toClientCoordX(x);
      const delta = this.distanceToPeriod(tempX - this._prevDrag);
      this.doDragging(delta);
      this._prevDrag = tempX;
    } else {
      this.resetDragSelInterval();

      let distance = 0;
      let shiftLeft = false;
      if (x < left) {
        shiftLeft = true;
        distance = x - left;
      } else {
        shiftLeft = false;
        distance = x - right;
      }

      const delta = this.distanceToPeriod(distance);
      this.dragSelInterval = setInterval(() => {
        this.doDragging(delta);

        if (!shiftLeft) {
          this.ensureDragVisible(false);
        }
      }, 300);
    }
  }

  doDragging(delta) {
    if (this._dragStatus === '') return
    if (delta === 0) return

    if (this._dragStatus === 'dragStart') {
      this.state._selStart = new Date(this.state._selStart.getTime() + delta)
    } else if (this._dragStatus === 'dragEnd') {
      this.state._selEnd = new Date(this.state._selEnd.getTime() + delta)
    } else if (this._dragStatus === 'dragMain') {
      this.state._selStart = new Date(this.state._selStart.getTime() + delta)
      this.state._selEnd = new Date(this.state._selEnd.getTime() + delta)
    }

    if (this.state._selStart.getTime() > this.state._selEnd.getTime()) {
      const temp = this.state._selStart
      this.state._selStart = this.state._selEnd
      this.state._selEnd = temp

      this._dragStatus = (
        this._dragStatus === 'dragStart' ? 'dragEnd' : 'dragStart'
      )
    }

    this.ensureDragVisible(this._dragStatus !== 'dragEnd')
    this.tickShifting()

    if (this.props.onSelChange) {
      this.props.onSelChange(this.state._selStart, this.state._selEnd)
    }
  }

  handleWinMouseMove(e) {
    const x = this.toClientCoordX(e.clientX)
    const start = this.state._selStart ? this.timeToX(this.state._selStart) : 0
    const end = this.state._selEnd ? this.timeToX(this.state._selEnd) : 0
    const delta = 15

    if (start <= x && x <= end) {
      document.body.style.cursor = 'pointer';
      if (x - start >= 0 && x - start <= delta) {
        document.body.style.cursor = 'e-resize';
      } else if (end - x >= 0 && end - x <= delta) {
        document.body.style.cursor = 'e-resize';
      }
    } else {
      document.body.style.cursor = 'default';
    }
  }

  postDrag(e) {
    this._dragStatus = ''
    this._prevDrag = null

    e.preventDefault()
    e.stopPropagation()

    this.removeDragObserver()
    this.resetDragSelInterval()
  }

  handleTouchStart(e) {
    this.preDrag(e)
    if (this._dragStatus !== '') {
      this.dragTouchMoveObserver = Rx.Observable.fromEvent(document, 'touchmove')
        .subscribe(this.dragging);
      this.dragTouchPostObserver = Rx.Observable.fromEvent(document, 'touchend')
        .subscribe(this.postDrag);
    } else {
      super.handleTouchStart(e)
    }
  }

  updateSpan(newSpan, mouseX) {
    const rcContainer = this._containerRect;
    const x = mouseX ? (mouseX - rcContainer.left) : 0;
    const t = this.xToTime(x);

    this.setSpan(newSpan, () => {
      const newX = this.timeToX(t);
      this.shift(Math.abs(x - newX), x < newX);
    });
  }

  getOtherLayers() {
    return [
      <canvas id="canvas_selmask" key="canvas_selmask"
        ref={c => this._canvasSelMask = c}
      />
    ]
  }

  getAllCanvas() {
    let ret = super.getAllCanvas()
    ret.push(this._canvasSelMask)
    return ret
  }

  draw() {
    super.draw()
    this.drawSelMask()
  }

  drawBkg() {
    const canvas = this._canvasBkg
    if (!canvas) return

    const width = canvas.width
    const height = canvas.height
    const ctx = canvas.getContext('2d')
    ctx.clearRect(0, 0, width, height)
    ctx.save()

    ctx.fillStyle = 'rgb(38, 44, 74)'
    ctx.fillRect(0, 0, width, 19)

    ctx.restore()
  }

  drawIndicator() {
    const canvas = this._canvasInd
    if (!canvas) return

    const width = canvas.width
    const height = canvas.height
    const ctx = canvas.getContext('2d')

    ctx.clearRect(0, 0, width, height)

    const playTime = this.props.playTime
    if (!playTime) return;

    const playX = this.timeToX(playTime)
    if (playX > width) return;

    ctx.save()
    ctx.beginPath()
    ctx.moveTo(playX, height)
    ctx.lineTo(playX, height - 30)
    ctx.strokeStyle = 'red'
    ctx.lineWidth = 2
    ctx.stroke()

    ctx.restore()
  }

  drawSelMask() {
    const selStart = this.state._selStart;
    const selEnd = this.state._selEnd;
    if (!selStart || !selEnd) return

    const canvas = this._canvasSelMask
    if (!canvas) return

    const spanSetting = this.getSpanSetting()

    const width = canvas.width
    const height = canvas.height
    const ctx = canvas.getContext('2d')

    ctx.clearRect(0, 0, width, height)
    ctx.save()

    const start = this.timeToX(selStart)
    const end = this.timeToX(selEnd)
    const yOffset = 6

    const gradient = ctx.createLinearGradient(0, yOffset, 0, height - yOffset);
    gradient.addColorStop(0, 'rgba(55, 100, 175, 0.6)')
    gradient.addColorStop(1, 'rgba(32, 52, 93, 0.4)')
    ctx.fillStyle = gradient
    ctx.fillRect(start, yOffset, end - start, height - yOffset * 2)

    ctx.restore()

    this.drawDragPoint(ctx, start, width, height)
    this.drawDragPoint(ctx, end, width, height)
  }

  drawDragPoint(ctx, x, w, h) {
    const yOffset = 6

    ctx.save()

    ctx.beginPath()
    ctx.moveTo(x, yOffset)
    ctx.lineTo(x - 4, 1)
    ctx.lineTo(x + 4, 1)
    ctx.closePath()
    ctx.fillStyle = 'rgb(64, 203, 205)'
    ctx.fill()

    ctx.moveTo(x, yOffset)
    ctx.lineTo(x, h + yOffset - 1)
    ctx.lineWidth = 1
    ctx.strokeStyle = 'rgb(64, 203, 205)'
    ctx.stroke()

    ctx.restore()
  }
};

export default RecordPanelTimeLine;
