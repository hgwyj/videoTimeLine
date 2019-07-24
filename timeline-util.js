export default class TimelineUtil {
  static numberToFixedWidthString(num, width) {
    var ret = '';

    if (0 === num) {
      for (var i = 0; i < width; i++) {
        ret += '0';
      }

      return ret;
    }

    for (var i = width-1; i >= 0; i--) {
      var div = parseInt(num / Math.pow(10, i));
      if (div === 0) {
        ret += '0';
      }
    }

    ret += num;
    return ret;
  }

  static calcDistance(p1, p2) {
    return Math.sqrt(
      Math.pow(p1.x - p2.x, 2) +
      Math.pow(p1.y - p2.y, 2)
    );
  }

  static convertTouchInfo(e) {
    return {
      clientX: e.targetTouches[0].clientX,
      clientY: e.targetTouches[0].clientY,
      timeStamp: e.timeStamp
    }
  }

  static getMouseInfo(e) {
    return {
      x: e.clientX,
      y: e.clientY,
      timeStamp: e.timeStamp
    }
  }

  static getTicks(start, end, mainUnit, subUnit, minorUnit) {
    const ticks = []

    let time = new Date(
      start.getFullYear(),
      start.getMonth(),
      start.getDate(),
      start.getHours()
    )

    // 主刻度
    while (mainUnit && time <= end) {
      const timeNext = new Date(time.getTime() + mainUnit)

      let subTime = new Date(time)
      // 辅刻度
      while (subUnit && subTime <= timeNext) {
        const subTimeNext = new Date(subTime.getTime() + subUnit)

        let minorTime = new Date(subTime)
      // 小刻度
        while (minorUnit && minorTime <= subTimeNext) {
          const minorTimeNext = new Date(minorTime.getTime() + minorUnit)

          if (subTime < minorTime && minorTime < subTimeNext) {
            ticks.push({
              time: minorTime,
              type: 'minor'
            })
          }

          minorTime = minorTimeNext
        }

        if (time < subTime && subTime < timeNext) {
          ticks.push({
            time: subTime,
            type: 'sub'
          })
        }

        subTime = subTimeNext
      }

      if (time >= start) {
        ticks.push({
          time: time,
          type: 'main'
        })
      }

      time = timeNext
    }

    return ticks
  }

  // DateTimeLine 获取刻度 subUnit
  static getDateTimeLineTicks(start, end, mainUnit, minorUnit) {
    const ticks = []
    var mainHour = mainUnit / 1000 / 60 / 60;
    var hours;
    if (mainHour > 1){
      hours = start.getHours() - start.getHours() % (mainHour);
    }else{
      hours = start.getHours();
    }

    let time = new Date(
      start.getFullYear(),
      start.getMonth(),
      start.getDate(),
      hours,

    )
    // console.log('getDateTimeLineTicks', 'start', start, 'end', end, 'mainUnit', mainUnit, 'minorUnit',minorUnit, 'time',time);
    // 主刻度
    while (mainUnit && time <= end) {
      const timeNext = new Date(time.getTime() + mainUnit)

      let minorTime = new Date(time)
      // 小刻度
      while (minorUnit && minorTime <= timeNext) {
        const minorTimeNext = new Date(minorTime.getTime() + minorUnit)

        if (minorTime < timeNext) {
          ticks.push({
            time: minorTime,
            type: 'minor'
          })
        }

        minorTime = minorTimeNext
      }

      if (time >= start) {
        ticks.push({
          time: time,
          type: 'main'
        })
      }

      time = timeNext
    }

    return ticks
  }
}
