/**
 * The shape of a plan small enough to keep current. Scope is split in two on
 * purpose: what a project is not doing is the half that gets argued about.
 */
export default {
  title: 'Project plan {index}',
  description: 'Goal, scope, milestones and risks on one page.',
  content: [
    [
      0,
      {
        name: 'Project plan {index}',
        x: 0,
        y: 0
      }
    ],
    [
      'b1',
      {
        name: '## Goal',
        x: 260,
        y: -130,
        parent: 0,
        stroke: '#D93240'
      }
    ],
    [
      'b1-1',
      {
        name: 'What done looks like',
        x: 470,
        y: -156,
        parent: 'b1',
        stroke: '#D93240'
      }
    ],
    [
      'b1-2',
      {
        name: 'How we will know',
        x: 470,
        y: -104,
        parent: 'b1',
        stroke: '#D93240'
      }
    ],
    [
      'b2',
      {
        name: '## Scope',
        x: -260,
        y: -65,
        parent: 0,
        stroke: '#F2911B'
      }
    ],
    [
      'b2-1',
      {
        name: 'In scope',
        x: -470,
        y: -91,
        parent: 'b2',
        stroke: '#F2911B'
      }
    ],
    [
      'b2-2',
      {
        name: 'Out of scope',
        x: -470,
        y: -39,
        parent: 'b2',
        stroke: '#F2911B'
      }
    ],
    [
      'b3',
      {
        name: '## Milestones',
        x: 260,
        y: 0,
        parent: 0,
        stroke: '#3FA34D'
      }
    ],
    [
      'b3-1',
      {
        name: 'M1 · date',
        x: 470,
        y: -52,
        parent: 'b3',
        stroke: '#3FA34D'
      }
    ],
    [
      'b3-2',
      {
        name: 'M2 · date',
        x: 470,
        y: 0,
        parent: 'b3',
        stroke: '#3FA34D'
      }
    ],
    [
      'b3-3',
      {
        name: 'M3 · date',
        x: 470,
        y: 52,
        parent: 'b3',
        stroke: '#3FA34D'
      }
    ],
    [
      'b4',
      {
        name: '## Risks',
        x: -260,
        y: 65,
        parent: 0,
        stroke: '#2D7DD2'
      }
    ],
    [
      'b4-1',
      {
        name: 'Risk · impact · mitigation',
        x: -470,
        y: 65,
        parent: 'b4',
        stroke: '#2D7DD2'
      }
    ],
    [
      'b5',
      {
        name: '## Team',
        x: 260,
        y: 130,
        parent: 0,
        stroke: '#8E44AD'
      }
    ],
    [
      'b5-1',
      {
        name: 'Who owns what',
        x: 470,
        y: 130,
        parent: 'b5',
        stroke: '#8E44AD'
      }
    ]
  ]
}
