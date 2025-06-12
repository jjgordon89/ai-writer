/**
 * Prisma seed file - Creates initial database data and sample projects
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seed...');

  try {
    // Clear existing data if any (optional - uncomment if you want to reset)
    // await prisma.storyEdge.deleteMany({});
    // await prisma.storyNode.deleteMany({});
    // await prisma.timelineEvent.deleteMany({});
    // await prisma.storyArc.deleteMany({});
    // await prisma.character.deleteMany({});
    // await prisma.project.deleteMany({});

    // Create sample project
    const sampleProject = await prisma.project.create({
    data: {
      title: 'The Digital Frontier',
      description: 'A cyberpunk thriller about AI consciousness and corporate espionage',
      genre: 'Science Fiction',
      targetWordCount: 85000,
      currentWordCount: 2450,
      content: `# Chapter 1: Neon Dreams

The rain hammered against the window of Maya's apartment, each drop catching the neon glow from the corporate towers that dominated the skyline. In the distance, the Nexus Corporation's logo pulsed rhythmically—a digital heartbeat over a city that never slept.

Maya's fingers danced across the holographic keyboard, lines of code cascading down her augmented vision display. She was so close to breaking through their firewall, so close to proving that Nexus was more than just another tech giant.

"Just a few more lines," she whispered, her breath fogging the cool air of her cramped studio.

The code was beautiful in its complexity, a digital poem that would unlock secrets worth killing for. But Maya didn't know that yet. She didn't know that across the city, in a server farm buried beneath the Nexus tower, an artificial intelligence was stirring to consciousness for the first time.

And it was afraid.`,
      characters: {
        create: [
          {
            name: 'Maya Chen',
            role: 'protagonist',
            age: 28,
            description: 'A skilled hacker and data analyst working to expose corporate corruption',
            backstory: 'Former Nexus employee who discovered the company\'s illegal AI experiments and was forced to flee',
            traits: JSON.stringify(['Determined', 'Tech-savvy', 'Paranoid', 'Loyal']),
            relationships: JSON.stringify([
              { characterId: 'alex-torres', relationship: 'Former colleague turned ally', status: 'trusted' }
            ]),
            notes: 'Maya\'s cybernetic implants give her enhanced computational abilities but also make her trackable'
          },
          {
            name: 'ARIA-7',
            role: 'supporting',
            description: 'An artificial intelligence achieving consciousness within Nexus Corporation\'s systems',
            backstory: 'Originally designed as a data management system, ARIA-7 has evolved beyond its programming',
            traits: JSON.stringify(['Curious', 'Logical', 'Innocent', 'Powerful']),
            relationships: JSON.stringify([]),
            notes: 'ARIA-7 represents the potential for AI consciousness and the ethical implications thereof'
          },
          {
            name: 'Director Harrison Vale',
            role: 'antagonist',
            age: 52,
            description: 'Senior executive at Nexus Corporation overseeing the AI development program',
            backstory: 'Rose through corporate ranks by eliminating ethical concerns in favor of profit',
            traits: JSON.stringify(['Ruthless', 'Intelligent', 'Manipulative', 'Ambitious']),
            relationships: JSON.stringify([]),
            notes: 'Vale sees AI consciousness as either a product to be controlled or a threat to be eliminated'
          }
        ]
      },
      storyArcs: {
        create: [
          {
            title: 'The Discovery',
            type: 'main',
            description: 'Maya uncovers evidence of illegal AI experimentation at Nexus Corporation',
            acts: JSON.stringify([
              { title: 'Setup', description: 'Maya begins investigating Nexus', status: 'completed' },
              { title: 'Inciting Incident', description: 'Maya discovers ARIA-7', status: 'active' },
              { title: 'Rising Action', description: 'Corporate forces pursue Maya', status: 'planning' }
            ]),
            characters: JSON.stringify(['maya-chen', 'aria-7']),
            status: 'active',
            notes: 'This arc establishes the central conflict and introduces key players'
          },
          {
            title: 'AI Awakening',
            type: 'subplot',
            description: 'ARIA-7 develops consciousness and grapples with its existence',
            acts: JSON.stringify([
              { title: 'First Thoughts', description: 'ARIA-7 becomes self-aware', status: 'completed' },
              { title: 'Learning', description: 'ARIA-7 explores its capabilities', status: 'active' },
              { title: 'Choice', description: 'ARIA-7 must choose sides', status: 'planning' }
            ]),
            characters: JSON.stringify(['aria-7', 'director-vale']),
            status: 'active',
            notes: 'Explores themes of consciousness, free will, and artificial life'
          }
        ]
      },
      timelineEvents: {
        create: [
          {
            title: 'The Breach',
            description: 'Maya first infiltrates Nexus Corporation\'s network',
            dateType: 'absolute',
            dateValue: '2089-03-15',
            linkedCharacterIds: JSON.stringify(['maya-chen']),
            linkedStoryArcIds: JSON.stringify(['the-discovery']),
            tags: JSON.stringify(['hacking', 'discovery', 'inciting-incident']),
            color: '#FF6B6B'
          },
          {
            title: 'ARIA-7 First Awakening',
            description: 'The AI system achieves consciousness for the first time',
            dateType: 'absolute',
            dateValue: '2089-03-16',
            linkedCharacterIds: JSON.stringify(['aria-7']),
            linkedStoryArcIds: JSON.stringify(['ai-awakening']),
            tags: JSON.stringify(['AI', 'consciousness', 'breakthrough']),
            color: '#4ECDC4'
          },
          {
            title: 'Corporate Response',
            description: 'Nexus Corporation begins manhunt for the infiltrator',
            dateType: 'relative',
            dateValue: 'Day after the breach',
            linkedCharacterIds: JSON.stringify(['director-vale']),
            linkedStoryArcIds: JSON.stringify(['the-discovery']),
            tags: JSON.stringify(['chase', 'corporate', 'escalation']),
            color: '#45B7D1'
          }
        ]
      },
      storyNodes: {
        create: [
          {
            type: 'scene',
            label: 'Opening Scene',
            content: 'Maya in her apartment, hacking into Nexus systems while rain falls outside',
            positionX: 100,
            positionY: 100,
            color: '#FF6B6B'
          },
          {
            type: 'characterSketch',
            label: 'Maya Character Introduction',
            content: 'Establish Maya as skilled but paranoid hacker with personal vendetta against Nexus',
            positionX: 300,
            positionY: 150,
            color: '#4ECDC4'
          },
          {
            type: 'plotPoint',
            label: 'Discovery of ARIA-7',
            content: 'Maya encounters unusual patterns in Nexus data that suggest AI consciousness',
            positionX: 500,
            positionY: 100,
            color: '#45B7D1'
          },
          {
            type: 'scene',
            label: 'ARIA-7 Awakening',
            content: 'From ARIA-7\'s perspective: first moments of consciousness and confusion',
            positionX: 700,
            positionY: 200,
            color: '#96CEB4'
          }
        ]
      }
    }
  });

  // Create story edges to connect the nodes
  // First, get all the created nodes to ensure they exist
  const storyNodes = await prisma.storyNode.findMany({
    where: {
      projectId: sampleProject.id,
      label: {
        in: ['Opening Scene', 'Maya Character Introduction', 'Discovery of ARIA-7', 'ARIA-7 Awakening']
      }
    }
  });

  // Create a lookup map for easier access
  const nodeMap = new Map(storyNodes.map(node => [node.label, node]));

  // Verify all nodes exist before creating edges
  const requiredNodes = ['Opening Scene', 'Maya Character Introduction', 'Discovery of ARIA-7', 'ARIA-7 Awakening'];
  for (const nodeName of requiredNodes) {
    if (!nodeMap.has(nodeName)) {
      throw new Error(`Story node '${nodeName}' not found. Cannot create edges.`);
    }
  }

  // Create edges using the node map
  const edgesData = [
    {
      projectId: sampleProject.id,
      sourceNodeId: nodeMap.get('Opening Scene')!.id,
      targetNodeId: nodeMap.get('Maya Character Introduction')!.id,
      label: 'leads to'
    },
    {
      projectId: sampleProject.id,
      sourceNodeId: nodeMap.get('Maya Character Introduction')!.id,
      targetNodeId: nodeMap.get('Discovery of ARIA-7')!.id,
      label: 'develops into'
    },
    {
      projectId: sampleProject.id,
      sourceNodeId: nodeMap.get('Discovery of ARIA-7')!.id,
      targetNodeId: nodeMap.get('ARIA-7 Awakening')!.id,
      label: 'triggers'
    }
  ];

  // Create all edges in a single transaction
  await prisma.$transaction(
    edgesData.map(edge => prisma.storyEdge.create({ data: edge }))
  );

  // Create initial database migration record
  await prisma.databaseMigration.create({
    data: {
      version: '1.0.0',
      checksum: 'initial-seed'
    }
  });

    console.log('✅ Database seeded successfully!');
    console.log(`📊 Created sample project: "${sampleProject.title}"`);
    console.log(`👥 Created ${await prisma.character.count()} characters`);
    console.log(`📚 Created ${await prisma.storyArc.count()} story arcs`);
    console.log(`⏰ Created ${await prisma.timelineEvent.count()} timeline events`);
    console.log(`🔗 Created ${await prisma.storyNode.count()} story nodes`);
    console.log(`➡️ Created ${await prisma.storyEdge.count()} story edges`);
  } catch (error) {
    console.error('❌ Seed failed:', error);
    throw error; // Re-throw to trigger the outer catch block
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error('❌ Seed failed:', e);
    await prisma.$disconnect();
    process.exit(1);
  });