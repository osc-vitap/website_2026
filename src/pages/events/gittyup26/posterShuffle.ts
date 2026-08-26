/*
 * Which poster a visitor without a ?pg gets.
 *
 * The old picker was Math.random() over the thirty sheets, which is
 * uniform but has replacement: roughly one visit in thirty served the
 * same poster twice in a row, and over a handful of visits some designs
 * came up repeatedly while others never appeared at all. Thirty designs
 * were drawn for this, so all thirty should be seen.
 *
 * So: a shuffled bag. The thirty ids are shuffled, dealt out one per
 * visit, and reshuffled only once the bag is empty. Every design
 * appears exactly once before any design appears twice, and the first
 * card of a new bag is never the last card of the old one — so an
 * immediate repeat is impossible rather than merely unlikely.
 *
 * The bag is kept in localStorage, so the cycle continues across
 * visits rather than restarting each time.
 */

const STORAGE_KEY = 'gittyup26.poster-bag.v1';

interface BagState {
	/** Ids not yet dealt this cycle. Dealt from the end. */
	bag: number[];
	/** The id served most recently, so a new bag cannot repeat it. */
	last: number | null;
}

/*
 * Kept in memory as well as in storage: Safari in private mode throws
 * on localStorage.setItem, and a visitor there should still get a
 * non-repeating sequence for as long as the tab is open.
 */
let memory: BagState = { bag: [], last: null };

/**
 * A uniform integer in [0, max).
 *
 * Uses the crypto RNG where there is one. The rejection loop matters:
 * taking a raw 32-bit value modulo 30 would make the first sixteen
 * posters very slightly likelier than the rest, which is exactly the
 * bias this whole module exists to remove.
 */
const randomInt = (max: number): number => {
	if (max <= 0) return 0;

	const crypto =
		typeof globalThis !== 'undefined'
			? globalThis.crypto
			: undefined;

	if (crypto?.getRandomValues) {
		const limit =
			Math.floor(0x1_0000_0000 / max) * max;

		const buffer = new Uint32Array(1);

		/* Expected iterations < 2 for any max this small. */
		for (let i = 0; i < 32; i += 1) {
			crypto.getRandomValues(buffer);
			if (buffer[0] < limit) {
				return buffer[0] % max;
			}
		}
	}

	return Math.floor(Math.random() * max);
};

/** Fisher-Yates. Unbiased, unlike sorting by a random comparator. */
const shuffle = (ids: number[]): number[] => {
	const out = [...ids];

	for (let i = out.length - 1; i > 0; i -= 1) {
		const j = randomInt(i + 1);
		[out[i], out[j]] = [out[j], out[i]];
	}

	return out;
};

const readState = (): BagState => {
	try {
		const raw =
			globalThis.localStorage?.getItem(
				STORAGE_KEY,
			);

		if (!raw) return memory;

		const parsed = JSON.parse(raw);

		if (
			!parsed ||
			!Array.isArray(parsed.bag) ||
			!parsed.bag.every(
				(id: unknown) =>
					typeof id === 'number',
			)
		) {
			return memory;
		}

		return {
			bag: parsed.bag,
			last:
				typeof parsed.last === 'number'
					? parsed.last
					: null,
		};
	} catch {
		/* Unavailable, disabled, or holding something else. */
		return memory;
	}
};

const writeState = (state: BagState): void => {
	memory = state;

	try {
		globalThis.localStorage?.setItem(
			STORAGE_KEY,
			JSON.stringify(state),
		);
	} catch {
		/* Memory already holds it. */
	}
};

/**
 * The next id to serve, advancing the bag.
 *
 * `poolIds` is passed in rather than read from the variant list so the
 * behaviour can be tested without the poster data, and so a stored bag
 * from an older release cannot serve an id that no longer exists.
 */
export const takeNextPosterId = (
	poolIds: number[],
): number => {
	if (poolIds.length === 0) {
		throw new Error(
			'No posters to choose from',
		);
	}

	if (poolIds.length === 1) return poolIds[0];

	const state = readState();

	/*
	 * Drop anything that is no longer in the run — adding or retiring a
	 * sheet must not strand a visitor on an id that has gone.
	 */
	const valid = new Set(poolIds);

	let bag = state.bag.filter((id) =>
		valid.has(id),
	);

	if (bag.length === 0) {
		bag = shuffle(poolIds);

		/*
		 * Cards are dealt off the end, so the end is what a fresh bag
		 * would serve next. If that is the poster just seen, swap it
		 * with any other position — this is the only place a repeat
		 * could otherwise occur.
		 */
		const lastIndex = bag.length - 1;

		if (
			state.last !== null &&
			bag[lastIndex] === state.last
		) {
			const other = randomInt(lastIndex);
			[bag[other], bag[lastIndex]] = [
				bag[lastIndex],
				bag[other],
			];
		}
	}

	const id = bag[bag.length - 1];

	writeState({
		bag: bag.slice(0, -1),
		last: id,
	});

	return id;
};

/**
 * Records a poster seen some other way than by being dealt — scanning a
 * printed QR, or following a ?pg= link.
 *
 * That is a view like any other, so it both blocks an immediate repeat
 * and is struck from the current cycle: someone who scanned sheet 5 in
 * a corridor and then opened the bare URL should be shown one of the
 * twenty-nine they have not seen, not the one still in their hand.
 */
export const notePosterSeen = (
	id: number,
	poolIds?: number[],
): void => {
	const state = readState();

	/*
	 * Seed the cycle if there is not one yet, so the strike below has
	 * something to strike from. Without this, someone whose first
	 * contact with the site is a scanned QR gets a bag dealt fresh
	 * afterwards that still contains the sheet they scanned — it would
	 * not come back immediately, but it would come back.
	 */
	const bag =
		state.bag.length === 0 && poolIds?.length
			? shuffle(poolIds)
			: state.bag;

	writeState({
		bag: bag.filter(
			(queued) => queued !== id,
		),
		last: id,
	});
};

/** Test seam: forget the cycle. */
export const resetPosterBag = (): void => {
	memory = { bag: [], last: null };

	try {
		globalThis.localStorage?.removeItem(
			STORAGE_KEY,
		);
	} catch {
		/* Nothing to clear. */
	}
};
