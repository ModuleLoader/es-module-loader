import { fn } from './circular2';

export var hello = 'world';

fn();

hello = 'another';

fn();