import moment from 'moment'
import Logger from 'log4jkjs';
moment.locale('zh-cn');

// 创建日志管理
let logger = new Logger("/TimeLine/CanvasUtils.js [CanvasUtils]");
logger.config('LOG', 'black', 'console');

class CanvasUtils {

  static init(dom, opt) {
    if (!dom) return

    const width = !!opt ? dom.width - opt.left : dom.width;
    logger.log('init(), width:', width, 'opt:', opt);
    const height = dom.height
    const ctx = dom.getContext('2d')

    let x = !!opt ? opt.left : 0;
    ctx.clearRect(x, 0, width, height)
    ctx.save()
    logger.log('init(), ctx:', ctx);
    return ctx;
  }

  static stroke(ctx, x1, y1, x2, y2, lineWidth, strokeStyle) {
    ctx.beginPath()
    ctx.moveTo(x1, y1)
    ctx.lineTo(x2, y2)
    ctx.strokeStyle = strokeStyle
    ctx.lineWidth = lineWidth
    ctx.stroke()
  }


  static fillText(ctx, text, x, y, fillStyle, font, textAlign) {
    ctx.font = font
    ctx.textAlign = textAlign
    ctx.fillStyle = fillStyle
    ctx.fillText(text, x, y)
  }

  static fillRect(ctx, x, y, width, height, fillStyle) {
    ctx.fillStyle = fillStyle;
    ctx.fillRect(x, y, width, height);
  }
}

export default CanvasUtils;
