let _debug = false;
const init = () => (_debug = true);

const time = (s: string) => _debug && global.console.time(s);
const timeEnd = (s: string) => _debug && global.console.timeEnd(s);
const log = (s: string) => _debug && global.console.log(s);

export const Debug = { time, timeEnd, init, log };
