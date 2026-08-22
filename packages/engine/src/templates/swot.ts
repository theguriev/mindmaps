/**
 * The classic four-quadrant analysis. The pairs sit opposite each other —
 * inside against outside, helpful against harmful — which is how it is read.
 */
export default {
  title: 'SWOT {index}',
  description: 'Strengths, weaknesses, opportunities and threats, in the four familiar corners.',
  content: [
    [
      0,
      {
        name: 'SWOT {index}',
        x: 0,
        y: 0
      }
    ],
    [
      'b1',
      {
        name: '## Strengths',
        x: 260,
        y: -65,
        parent: 0,
        stroke: '#D93240'
      }
    ],
    [
      'b1-1',
      {
        name: 'What we do well',
        x: 470,
        y: -91,
        parent: 'b1',
        stroke: '#D93240'
      }
    ],
    [
      'b1-2',
      {
        name: 'What we have that others do not',
        x: 470,
        y: -39,
        parent: 'b1',
        stroke: '#D93240'
      }
    ],
    [
      'b2',
      {
        name: '## Weaknesses',
        x: -260,
        y: -65,
        parent: 0,
        stroke: '#F2911B'
      }
    ],
    [
      'b2-1',
      {
        name: 'What we do badly',
        x: -470,
        y: -91,
        parent: 'b2',
        stroke: '#F2911B'
      }
    ],
    [
      'b2-2',
      {
        name: 'What we lack',
        x: -470,
        y: -39,
        parent: 'b2',
        stroke: '#F2911B'
      }
    ],
    [
      'b3',
      {
        name: '## Opportunities',
        x: 260,
        y: 65,
        parent: 0,
        stroke: '#3FA34D'
      }
    ],
    [
      'b3-1',
      {
        name: 'A change we could use',
        x: 470,
        y: 39,
        parent: 'b3',
        stroke: '#3FA34D'
      }
    ],
    [
      'b3-2',
      {
        name: 'An unmet need',
        x: 470,
        y: 91,
        parent: 'b3',
        stroke: '#3FA34D'
      }
    ],
    [
      'b4',
      {
        name: '## Threats',
        x: -260,
        y: 65,
        parent: 0,
        stroke: '#2D7DD2'
      }
    ],
    [
      'b4-1',
      {
        name: 'A change that could hurt',
        x: -470,
        y: 39,
        parent: 'b4',
        stroke: '#2D7DD2'
      }
    ],
    [
      'b4-2',
      {
        name: 'Who could take this',
        x: -470,
        y: 91,
        parent: 'b4',
        stroke: '#2D7DD2'
      }
    ]
  ]
}
