
export class Lru {
    maxSize = 2 ** 14
    size = 0;
    resets = 0;
    cacheA = new Map();
    cacheB = new Map();

    get(key, fetcher) {
        let existing = this.cacheA.get(key);
        if (existing) {
            existing.hits++;
            return existing;
        }

        existing = this.cacheB.get(key);
        if (existing) {
            existing.hits++;
            existing.saves++;

            this.cacheA.set(key, existing);
            return existing;
        }

        existing = { promise: fetcher(), hits: 0, saves: 0, key };

        if (this.cacheA.size > this.maxSize) {
            this.size = existing.size;
            this.cacheB = this.cacheA;
            this.cacheA = new Map();
            this.resets++;
        }
        this.cacheA.set(key, existing);
        return existing;
    }

    toJSON() {
        const values = [...this.cacheA.values()].map(f => {
            return { ...f, promise: undefined }
        });
        values.sort((a, b) => a.hits - b.hits)
        return { maxSize: this.maxSize, cacheA: this.cacheA.size, cacheB: this.cacheB.size, resets: this.resets, cache: values }
    }
}
