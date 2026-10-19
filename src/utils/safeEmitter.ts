import { consoleText, niceTry } from './tools';

/** Observer failures must not interrupt committed SDK work or later observers. */
export const emitSafely = (emitter: any, message: string, args: any) => {
  const invoke = (handler: any, wildcard = false) => {
    try {
      if (wildcard) handler(message, args);
      else handler(args);
    } catch (error) {
      niceTry(() => consoleText(`事件监听器执行失败 ${message}: ${error}`, 'error'));
    }
  };
  if (emitter?.all?.get) {
    emitter.all.get(message)?.slice().forEach((handler: any) => invoke(handler));
    emitter.all.get('*')?.slice().forEach((handler: any) => invoke(handler, true));
  } else {
    invoke((value: any) => emitter?.emit(message, value));
  }
};
