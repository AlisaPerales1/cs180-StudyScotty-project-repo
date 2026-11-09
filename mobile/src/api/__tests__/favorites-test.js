/** @type {typeof import('../favorites')} */
let favorites;

// The mock keeps state in the module, so load a fresh copy for every test.
beforeEach(() => {
  jest.resetModules();
  favorites = require('../favorites');
});

describe('favorites mock API', () => {
  it('starts with the sample favorite', async () => {
    const list = await favorites.listFavorites();
    expect(list.map((favorite) => favorite.spot.name)).toEqual(['Orbach Science Library']);
  });

  it('adds a favorite with the reminder off, newest first', async () => {
    const added = await favorites.addFavorite(1);

    expect(added).toEqual({
      spot: { id: 1, name: 'Rivera Library' },
      opening_reminder_enabled: false,
      created_at: expect.any(String),
    });
    expect((await favorites.listFavorites()).map((favorite) => favorite.spot.id)).toEqual([1, 2]);
  });

  it('keeps one favorite per spot, like the database constraint', async () => {
    const first = await favorites.addFavorite(1);
    const second = await favorites.addFavorite(1);

    expect(second).toEqual(first);
    expect(await favorites.listFavorites()).toHaveLength(2);
  });

  it('removes a favorite, and removing twice is harmless', async () => {
    await favorites.removeFavorite(2);
    await favorites.removeFavorite(2);

    expect(await favorites.getFavorite(2)).toBeNull();
    expect(await favorites.listFavorites()).toEqual([]);
  });

  it('turning on the opening reminder favorites the spot', async () => {
    const favorite = await favorites.setOpeningReminderEnabled(1, true);

    expect(favorite.opening_reminder_enabled).toBe(true);
    expect(await favorites.getFavorite(1)).toEqual(favorite);
  });

  it('turning off the reminder keeps the favorite', async () => {
    await favorites.setOpeningReminderEnabled(2, true);
    const favorite = await favorites.setOpeningReminderEnabled(2, false);

    expect(favorite.opening_reminder_enabled).toBe(false);
    expect(await favorites.getFavorite(2)).not.toBeNull();
  });

  it('turning off the reminder for a non-favorite does not create one', async () => {
    await expect(favorites.setOpeningReminderEnabled(1, false)).resolves.toBeNull();
    expect(await favorites.getFavorite(1)).toBeNull();
  });

  it('rejects spots that do not exist', async () => {
    await expect(favorites.addFavorite(999)).rejects.toThrow('Spot not found');
    await expect(favorites.setOpeningReminderEnabled(999, true)).rejects.toThrow('Spot not found');
  });
});
