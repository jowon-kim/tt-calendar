'use strict';

/* No holidays — the default, and the shape every holiday set follows.
 * See holidays/kr.js for a real one. */

const EMPTY = new Map();

window.HOLIDAYS = window.HOLIDAYS || {};
window.HOLIDAYS.none = { label: 'region.none', holidays: () => EMPTY };
