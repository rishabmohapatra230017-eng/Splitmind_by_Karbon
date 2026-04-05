import { initializeStore, readStore, resetStore } from './store.js';

export function seedDatabase() {
  initializeStore();
  const state = readStore();
  state.users.forEach((user) => {
    user.isCurrentUser = false;
  });
  state.participants.forEach((participant) => {
    participant.isCurrentUser = false;
  });
  resetStore(state);
}

export function resetSeedData() {
  initializeStore();
  const state = readStore();
  const currentUser = state.users.find((user) => user.isCurrentUser) ?? null;

  resetStore({
    counters: {
      users: currentUser ? 1 : 0,
      groups: 0,
      participants: 0,
      expenses: 0,
      expenseSplits: 0
    },
    users: currentUser
      ? [
          {
            ...currentUser,
            id: 1,
            isCurrentUser: true
          }
        ]
      : [],
    groups: [],
    participants: [],
    expenses: [],
    expenseSplits: []
  });
}

if (process.argv[1]?.endsWith('seed.ts')) {
  seedDatabase();
  console.log('Prepared SplitMint store with no active user session');
}
