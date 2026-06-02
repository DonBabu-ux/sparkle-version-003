export class FeedPaginationAudit {
  private static lastPageLoaded = -1;
  private static totalItemsLoaded = 0;
  private static startTime = Date.now();

  static logRequest(page: number, limit: number) {
    const elapsed = ((Date.now() - this.startTime) / 1000).toFixed(2);
    console.info(`%c[Feed Pagination Audit] [${elapsed}s] requesting feed stream page=${page}, limit=${limit}`, 'color: #ff007f; font-weight: bold;');
    
    if (page === this.lastPageLoaded) {
      console.warn(`%c[Feed Pagination Audit] DUP REQUEST DETECTED: Page ${page} requested twice in a row!`, 'color: #e5a93c; font-weight: bold;');
    }
    this.lastPageLoaded = page;
  }

  static logResponse(momentsCount: number, hasMore: boolean) {
    this.totalItemsLoaded += momentsCount;
    const elapsed = ((Date.now() - this.startTime) / 1000).toFixed(2);
    console.info(
      `%c[Feed Pagination Audit] [${elapsed}s] response: fetched ${momentsCount} moments (total unique = ${this.totalItemsLoaded}), hasMore = ${hasMore}`,
      'color: #00ff7f; font-weight: bold;'
    );
    if (momentsCount === 0 && hasMore) {
      console.warn('%c[Feed Pagination Audit] Backend returned 0 elements but hasMore=true! Loop risk!', 'color: red; font-weight: bold;');
    }
  }

  static reset() {
    this.lastPageLoaded = -1;
    this.totalItemsLoaded = 0;
    this.startTime = Date.now();
  }
}
