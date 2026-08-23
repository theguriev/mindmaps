/**
 * A decision record. The last branch is the point of the whole map: a choice
 * with its reasoning attached outlives the meeting that produced it.
 */
export default {
  title: 'Decision {index}',
  description: 'The options, what matters, and the call — written down before it is forgotten.',
  content: [
    [
      0,
      {
        name: 'Decision {index}',
        x: 0,
        y: 0
      }
    ],
    [
      'b1',
      {
        name: '## The question',
        x: 260,
        y: -130,
        parent: 0,
        stroke: '#D93240'
      }
    ],
    [
      'b1-1',
      {
        name: 'What exactly are we deciding?',
        x: 470,
        y: -130,
        parent: 'b1',
        stroke: '#D93240'
      }
    ],
    [
      'b2',
      {
        name: '## Options',
        x: -260,
        y: -65,
        parent: 0,
        stroke: '#F2911B'
      }
    ],
    [
      'b2-1',
      {
        name: 'Option A',
        x: -470,
        y: -117,
        parent: 'b2',
        stroke: '#F2911B'
      }
    ],
    [
      'b2-2',
      {
        name: 'Option B',
        x: -470,
        y: -65,
        parent: 'b2',
        stroke: '#F2911B'
      }
    ],
    [
      'b2-3',
      {
        name: 'Do nothing',
        x: -470,
        y: -13,
        parent: 'b2',
        stroke: '#F2911B'
      }
    ],
    [
      'b3',
      {
        name: '## What matters',
        x: 260,
        y: 0,
        parent: 0,
        stroke: '#3FA34D'
      }
    ],
    [
      'b3-1',
      {
        name: 'Criteria, most important first',
        x: 470,
        y: 0,
        parent: 'b3',
        stroke: '#3FA34D'
      }
    ],
    [
      'b4',
      {
        name: '## Trade-offs',
        x: -260,
        y: 65,
        parent: 0,
        stroke: '#2D7DD2'
      }
    ],
    [
      'b4-1',
      {
        name: 'Cost',
        x: -470,
        y: 13,
        parent: 'b4',
        stroke: '#2D7DD2'
      }
    ],
    [
      'b4-2',
      {
        name: 'Risk',
        x: -470,
        y: 65,
        parent: 'b4',
        stroke: '#2D7DD2'
      }
    ],
    [
      'b4-3',
      {
        name: 'Time',
        x: -470,
        y: 117,
        parent: 'b4',
        stroke: '#2D7DD2'
      }
    ],
    [
      'b5',
      {
        name: '## The call',
        x: 260,
        y: 130,
        parent: 0,
        stroke: '#8E44AD'
      }
    ],
    [
      'b5-1',
      {
        name: 'Chosen · why · when to revisit',
        x: 470,
        y: 130,
        parent: 'b5',
        stroke: '#8E44AD'
      }
    ]
  ]
}
