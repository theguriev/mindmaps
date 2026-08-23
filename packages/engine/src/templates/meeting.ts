/**
 * A meeting that leaves no decision or owner behind. The four branches are
 * what people forget to write down, in the order a meeting produces them.
 */
export default {
  title: 'Meeting notes {index}',
  description: 'Agenda, decisions and who does what next — filled in as the meeting runs.',
  content: [
    [
      0,
      {
        name: 'Meeting notes {index}',
        x: 0,
        y: 0
      }
    ],
    [
      'b1',
      {
        name: '## Agenda',
        x: 260,
        y: -130,
        parent: 0,
        stroke: '#D93240'
      }
    ],
    [
      'b1-1',
      {
        name: 'First topic',
        x: 470,
        y: -182,
        parent: 'b1',
        stroke: '#D93240'
      }
    ],
    [
      'b1-2',
      {
        name: 'Second topic',
        x: 470,
        y: -130,
        parent: 'b1',
        stroke: '#D93240'
      }
    ],
    [
      'b1-3',
      {
        name: 'Third topic',
        x: 470,
        y: -78,
        parent: 'b1',
        stroke: '#D93240'
      }
    ],
    [
      'b2',
      {
        name: '## Decisions',
        x: -260,
        y: -65,
        parent: 0,
        stroke: '#F2911B'
      }
    ],
    [
      'b2-1',
      {
        name: 'What was decided, and why',
        x: -470,
        y: -65,
        parent: 'b2',
        stroke: '#F2911B'
      }
    ],
    [
      'b3',
      {
        name: '## Action items',
        x: 260,
        y: 0,
        parent: 0,
        stroke: '#3FA34D'
      }
    ],
    [
      'b3-1',
      {
        name: 'Who · what · by when',
        x: 470,
        y: -26,
        parent: 'b3',
        stroke: '#3FA34D'
      }
    ],
    [
      'b3-2',
      {
        name: 'Who · what · by when',
        x: 470,
        y: 26,
        parent: 'b3',
        stroke: '#3FA34D'
      }
    ],
    [
      'b4',
      {
        name: '## Open questions',
        x: -260,
        y: 65,
        parent: 0,
        stroke: '#2D7DD2'
      }
    ],
    [
      'b4-1',
      {
        name: 'Still unanswered',
        x: -470,
        y: 65,
        parent: 'b4',
        stroke: '#2D7DD2'
      }
    ],
    [
      'b5',
      {
        name: '## Attendees',
        x: 260,
        y: 130,
        parent: 0,
        stroke: '#8E44AD'
      }
    ],
    [
      'b5-1',
      {
        name: 'Who was there',
        x: 470,
        y: 130,
        parent: 'b5',
        stroke: '#8E44AD'
      }
    ]
  ]
}
