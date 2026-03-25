import { writable } from 'svelte/store';

export const players = writable([]);
export const phase = writable('lobby');
export const roundData = writable(null);
export const scoreboard = writable([]);
export const myScore = writable(0);
export const answers = writable([]);
export const reveal = writable(null);
