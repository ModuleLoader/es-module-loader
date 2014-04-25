import { hello } from './circular1';

export function fn() {
  if (!global.first)
    global.first = hello;
  else
    global.second = hello;
}