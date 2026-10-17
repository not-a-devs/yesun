/* 가상 캠퍼스 데이터. 실제 건물 및 거리와 무관합니다. */
(() => {
  'use strict';
  window.CampusData = Object.freeze({
    DAYS: [
      { id: 'mon', label: '월요일', short: '월', en: 'MON' },
      { id: 'tue', label: '화요일', short: '화', en: 'TUE' },
      { id: 'wed', label: '수요일', short: '수', en: 'WED' },
      { id: 'thu', label: '목요일', short: '목', en: 'THU' },
      { id: 'fri', label: '금요일', short: '금', en: 'FRI' }
    ],
    BUILDINGS: ['A', 'B', 'C', 'D'],
    WALK_TIMES: {
      A: { A: 0, B: 10, C: 8, D: 15 },
      B: { A: 10, B: 0, C: 7, D: 13 },
      C: { A: 8, B: 7, C: 0, D: 6 },
      D: { A: 15, B: 13, C: 6, D: 0 }
    },
    EXAMPLE_CLASSES: [
      { id: 'sample-1', name: '자료구조', day: 'mon', start: '09:00', end: '10:15', building: 'A' },
      { id: 'sample-2', name: '웹프로그래밍', day: 'mon', start: '10:30', end: '11:45', building: 'B' },
      { id: 'sample-3', name: '데이터베이스', day: 'mon', start: '11:55', end: '13:10', building: 'D' },
      { id: 'sample-4', name: '알고리즘', day: 'tue', start: '13:00', end: '14:15', building: 'C' },
      { id: 'sample-5', name: '컴퓨터구조', day: 'tue', start: '14:20', end: '15:35', building: 'A' }
    ]
  });
})();
