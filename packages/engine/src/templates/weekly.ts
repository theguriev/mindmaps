/**
 * A retrospective for one person or one team. Kept to four branches because a
 * review nobody finishes is a review nobody repeats.
 */
export default {
  title: 'Week in review {index}',
  description: 'What went well, what did not, and what changes next week.',
  content: [
    [
      0,
      {
        name: 'Week in review {index}',
        x: 0,
        y: 0
      }
    ],
    [
      'b1',
      {
        name: '## Went well',
        x: 260,
        y: -65,
        parent: 0,
        stroke: '#D93240'
      }
    ],
    [
      'b1-1',
      {
        name: 'Worth repeating',
        x: 470,
        y: -65,
        parent: 'b1',
        stroke: '#D93240'
      }
    ],
    [
      'b2',
      {
        name: '## Went badly',
        x: -260,
        y: -65,
        parent: 0,
        stroke: '#F2911B'
      }
    ],
    [
      'b2-1',
      {
        name: 'Worth fixing',
        x: -470,
        y: -65,
        parent: 'b2',
        stroke: '#F2911B'
      }
    ],
    [
      'b3',
      {
        name: '## Learned',
        x: 260,
        y: 65,
        parent: 0,
        stroke: '#3FA34D'
      }
    ],
    [
      'b3-1',
      {
        name: 'Something now known that was not',
        x: 470,
        y: 65,
        parent: 'b3',
        stroke: '#3FA34D'
      }
    ],
    [
      'b4',
      {
        name: '## Next week',
        x: -260,
        y: 65,
        parent: 0,
        stroke: '#2D7DD2'
      }
    ],
    [
      'b4-1',
      {
        name: 'Top three, in order',
        x: -470,
        y: 65,
        parent: 'b4',
        stroke: '#2D7DD2'
      }
    ]
  ]
}
