import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

type Args = {
  all: boolean;
  commit: boolean;
  clearTrial: boolean;
  emails: string[];
  domains: string[];
};

function parseArgs(argv: string[]): Args {
  const args: Args = {
    all: false,
    commit: false,
    clearTrial: false,
    emails: [],
    domains: [],
  };

  for (const a of argv) {
    if (a === '--all') args.all = true;
    else if (a === '--commit') args.commit = true;
    else if (a === '--clear-trial') args.clearTrial = true;
    else if (a.startsWith('--email=')) {
      const list = a.split('=')[1]?.trim() || '';
      if (list) args.emails = list.split(',').map((s) => s.trim()).filter(Boolean);
    } else if (a.startsWith('--domain=')) {
      const list = a.split('=')[1]?.trim() || '';
      if (list) args.domains = list.split(',').map((s) => s.replace(/^@/, '').trim()).filter(Boolean);
    }
  }

  return args;
}

function buildWhere(args: Args) {
  if (args.all) return {}; // no filter
  const OR: any[] = [];

  if (args.emails.length) {
    for (const email of args.emails) {
      OR.push({ email });
    }
  }

  if (args.domains.length) {
    for (const d of args.domains) {
      OR.push({ email: { endsWith: `@${d}` } });
    }
  }

  if (OR.length === 0) {
    throw new Error(
      'No filters provided. Use --all to reset everyone, or provide --email=a@x.com,b@y.com and/or --domain=example.com'
    );
  }

  return { OR };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  console.log('=== Reset All Subscriptions (Preview) ===');
  console.log('Options:', {
    all: args.all,
    commit: args.commit,
    clearTrial: args.clearTrial,
    emails: args.emails,
    domains: args.domains,
  });

  const where = buildWhere(args);

  // Preview current affected users
  const users = await prisma.user.findMany({
    where,
    select: {
      id: true,
      email: true,
      subscriptionStatus: true,
      subscriptionPlan: true,
      subscriptionId: true,
      customerId: true,
      subscriptionEndsAt: true,
      trialUsedAt: true,
      createdAt: true,
    },
  });

  console.log(`Found ${users.length} user(s) to reset.`);
  if (users.length) {
    console.table(
      users.map((u) => ({
        email: u.email,
        status: u.subscriptionStatus,
        plan: u.subscriptionPlan,
        subscriptionId: u.subscriptionId,
        customerId: u.customerId,
        endsAt: u.subscriptionEndsAt?.toISOString() ?? null,
        trialUsedAt: u.trialUsedAt?.toISOString() ?? null,
      }))
    );
  }

  if (!args.commit) {
    console.log('\nDRY RUN: No changes applied. Re-run with --commit to apply changes.');
    console.log('Examples:');
    console.log('  npx tsx scripts/reset-all-subscriptions.ts --all --commit --clear-trial');
    console.log('  npx tsx scripts/reset-all-subscriptions.ts --domain=example.com --commit');
    console.log('  npx tsx scripts/reset-all-subscriptions.ts --email=a@x.com,b@y.com --commit');
    await prisma.$disconnect();
    return;
  }

  // Apply reset
  console.log('\nApplying reset...');
  const data: any = {
    subscriptionStatus: 'free',
    subscriptionPlan: null,
    subscriptionId: null,
    customerId: null,
    subscriptionEndsAt: null,
  };
  if (args.clearTrial) data.trialUsedAt = null;

  const result = await prisma.user.updateMany({
    where,
    data,
  });

  console.log(`✅ Reset completed. Updated ${result.count} user(s).`);

  // Show a quick sample after update
  const after = await prisma.user.findMany({
    where,
    take: 10,
    select: {
      email: true,
      subscriptionStatus: true,
      subscriptionPlan: true,
      subscriptionId: true,
      customerId: true,
      subscriptionEndsAt: true,
      trialUsedAt: true,
    },
  });

  console.log('\nSample after update (first 10):');
  console.table(
    after.map((u) => ({
      email: u.email,
      status: u.subscriptionStatus,
      plan: u.subscriptionPlan,
      subscriptionId: u.subscriptionId,
      customerId: u.customerId,
      endsAt: u.subscriptionEndsAt?.toISOString() ?? null,
      trialUsedAt: u.trialUsedAt?.toISOString() ?? null,
    }))
  );
}

main()
  .catch((e) => {
    console.error('❌ Error during reset:', e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });