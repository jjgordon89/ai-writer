# Database Setup Guide - Phase 1: SQLite Integration with Prisma

This guide will help you set up SQLite integration alongside the existing localStorage system for the AI Fiction Writer application.

## Prerequisites

- Node.js 18+ installed
- npm or yarn package manager
- The existing AI Fiction Writer application

## Installation Steps

### 1. Install Dependencies

The necessary dependencies have been added to `package.json`. Run:

```bash
npm install
```

This will install:
- `@prisma/client` - Prisma database client
- `prisma` - Prisma CLI and development tools
- `tsx` - TypeScript execution for seed scripts

### 2. Generate Prisma Client

Generate the Prisma client based on the schema:

```bash
npm run db:generate
```

### 3. Initialize Database

Create and migrate the SQLite database:

```bash
npm run db:push
```

This creates a `dev.db` file in the `prisma/` directory.

### 4. Seed Sample Data (Optional)

Populate the database with sample data:

```bash
npm run db:seed
```

This creates a sample cyberpunk project with characters, story arcs, and timeline events.

### 5. Verify Setup

Check if everything is working:

```bash
npm run db:studio
```

This opens Prisma Studio in your browser to view and edit database data.

## Environment Configuration

The application uses these environment variables:

```env
# Database
DATABASE_URL="file:./dev.db"

# Environment
NODE_ENV="development"
```

For production, you'll want to use an absolute path:
```env
DATABASE_URL="file:/path/to/your/app/data/production.db"
```

## How the Hybrid System Works

The application now includes a `HybridDataService` that:

1. **Starts with localStorage** - Existing data remains accessible
2. **Attempts database connection** - If successful, new data goes to SQLite
3. **Provides migration tools** - Move data from localStorage to database
4. **Fallback support** - If database fails, falls back to localStorage

## Migration Process

### Check Migration Status

The hybrid service can check what data exists where:

```typescript
import { hybridDataService } from './src/services/hybridDataService';

const status = await hybridDataService.getMigrationStatus();
console.log(status);
// {
//   canMigrate: true,
//   hasLocalData: true,
//   hasDatabaseData: false
// }
```

### Migrate Data

To migrate existing localStorage data to the database:

```typescript
const migrationStatus = await hybridDataService.migrateToDatabase();
console.log(migrationStatus);
// {
//   totalProjects: 3,
//   migratedProjects: 3,
//   errors: [],
//   isComplete: true
// }
```

## Database Schema

The SQLite database includes these tables:

- **projects** - Main project data
- **characters** - Character information
- **story_arcs** - Story arc and plot structure
- **timeline_events** - Timeline and chronology
- **story_nodes** - Story planner nodes
- **story_edges** - Connections between story nodes
- **database_migrations** - Migration tracking
- **project_analytics** - Performance metrics

## Available Scripts

```bash
# Generate Prisma client
npm run db:generate

# Push schema changes to database
npm run db:push

# Create a new migration
npm run db:migrate

# Open Prisma Studio
npm run db:studio

# Seed sample data
npm run db:seed

# Reset database (destructive)
npm run db:reset
```

## Development Workflow

1. **Make schema changes** in `prisma/schema.prisma`
2. **Push changes** with `npm run db:push`
3. **Generate client** with `npm run db:generate`
4. **Update services** if needed
5. **Test changes** with the application

## Production Considerations

### Database Location
- Development: `./dev.db` (relative to project)
- Production: Use absolute path in a persistent directory

### Backup Strategy
```bash
# Create backup
cp dev.db backup-$(date +%Y%m%d).db

# Or use the built-in export
# (implemented in the database service)
```

### Performance
- SQLite is single-threaded but very fast for this use case
- No connection pooling needed (SQLite handles this internally)
- WAL mode enabled for better concurrency

## Troubleshooting

### Common Issues

1. **"Cannot find module '@prisma/client'"**
   ```bash
   npm run db:generate
   ```

2. **Database file not found**
   - Check `DATABASE_URL` in `.env`
   - Run `npm run db:push` to create database

3. **Migration errors**
   - Check database file permissions
   - Ensure SQLite is supported on your system

4. **Type errors in database service**
   - Ensure Prisma client is generated
   - Restart TypeScript server in your editor

### Health Check

The hybrid service includes health checking:

```typescript
const health = await hybridDataService.healthCheck();
console.log(health);
// {
//   localStorage: { status: 'healthy', details: 'localStorage accessible' },
//   database: { status: 'healthy', details: 'Database connection successful' },
//   overall: 'healthy'
// }
```

## Next Steps

Once Phase 1 is working:
- **Phase 2**: Add LanceDB for vector search
- **Phase 3**: Implement real-time sync
- **Phase 4**: Add collaborative features
- **Phase 5**: Migration to PostgreSQL (if needed)

## File Structure

```
├── prisma/
│   ├── schema.prisma          # Database schema
│   ├── seed.ts               # Sample data
│   └── dev.db               # SQLite database (created)
├── src/services/
│   ├── database.ts          # Prisma database service
│   └── hybridDataService.ts # Hybrid localStorage/DB service
├── .env                     # Environment variables
└── package.json            # Updated with database scripts
```

This setup provides a robust foundation for data persistence while maintaining compatibility with existing localStorage data.