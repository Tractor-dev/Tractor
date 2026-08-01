import { expect, test } from '@playwright/test';

async function createRoom(page, roomName = '我的房间', { testRuleName = null } = {}) {
  await page.addInitScript(() => localStorage.removeItem('tractorRoomSession'));
  await page.goto('/');
  await expect(page.getByRole('button', { name: '创建房间' })).toBeEnabled();
  await page.getByRole('button', { name: '创建房间' }).click();

  const dialog = page.getByRole('dialog', { name: '创建房间' });
  await dialog.getByLabel('房间名称').fill(roomName);
  await dialog.getByLabel('发牌间隔（毫秒）').fill('10');
  if (testRuleName) {
    await dialog.getByRole('checkbox', { name: '规则测试模式' }).check();
    await dialog.locator('.ant-select-selector').click();
    await dialog.getByLabel('测试规则').fill(testRuleName);
    await page.locator('.ant-select-dropdown:visible').getByText(testRuleName, { exact: true }).click();
  }
  await dialog.getByRole('button', { name: /创\s*建/ }).click();

  const roomIdText = await page.getByText(/房间ID:/).textContent();
  return roomIdText.match(/\d+/)[0];
}

async function joinRoom(page, roomId, playerName) {
  await page.addInitScript(() => localStorage.removeItem('tractorRoomSession'));
  await page.goto('/');
  await expect(page.getByRole('button', { name: '加入房间' })).toBeEnabled();
  await page.getByRole('button', { name: '加入房间' }).click();

  const dialog = page.getByRole('dialog', { name: '加入房间' });
  await dialog.getByLabel('房间ID').fill(roomId);
  await dialog.getByLabel('你的昵称').fill(playerName);
  await dialog.getByRole('button', { name: /加\s*入/ }).click();
  await expect(page.getByText(`房间ID: ${roomId}`)).toBeVisible();
}

const openingExchangeRules = {
  知己知彼: { id: 'know_yourself_and_enemy', targetOffset: 2, incomingOffset: 2, endX: '50%', endY: '11%' },
  新闻部长I: { id: 'news_minister_i', targetOffset: -1, incomingOffset: 1, endX: '9%', endY: '50%' },
  新闻部长II: { id: 'news_minister_ii', targetOffset: 1, incomingOffset: -1, endX: '91%', endY: '50%' }
};

async function finishOpeningExchange(pages) {
  await Promise.all(pages.map((playerPage) =>
    expect(playerPage.getByRole('button', { name: /确认换牌\(0\/2\)/ })).toBeVisible({ timeout: 20_000 })
  ));
  await Promise.all(pages.map(async (playerPage) => {
    const cards = playerPage.locator('.my-hand .card');
    await cards.nth(0).dispatchEvent('click');
    await cards.nth(1).dispatchEvent('click');
  }));
  await Promise.all(pages.map((playerPage) =>
    playerPage.getByRole('button', { name: /确认换牌\(2\/2\)/ }).click()
  ));
  await Promise.all(pages.map((playerPage) =>
    expect(playerPage.locator('.card-exchange-animation-layer')).toBeHidden({ timeout: 5_000 })
  ));
}

async function selectLegalCard(cards, playButton) {
  const cardCount = await cards.count();
  for (let index = 0; index < cardCount; index += 1) {
    await cards.nth(index).dispatchEvent('click');
    if (await playButton.isEnabled()) return;
    await cards.nth(index).dispatchEvent('click');
  }
  throw new Error('没有找到可出的单张牌');
}

async function playLegalSingle(page) {
  const playButton = page.getByRole('button', { name: /^出牌\(\d+\)$/ });
  await selectLegalCard(page.locator('.my-hand .card'), playButton);
  await expect(playButton).toBeEnabled();
  await playButton.click();
}

async function openGameOfferingRule(browser, targetRuleName, targetRuleId) {
  const context = await browser.newContext();
  const hostPage = await context.newPage();
  const testRoomName = `__e2e_rule__:${targetRuleId}`;
  const roomId = await createRoom(hostPage, testRoomName);
  await expect(hostPage.getByRole('heading', { name: `房间: ${testRoomName}` })).toBeVisible();
  const pages = [hostPage];

  for (let playerIndex = 2; playerIndex <= 4; playerIndex += 1) {
    const playerPage = await context.newPage();
    pages.push(playerPage);
    await joinRoom(playerPage, roomId, `玩家${playerIndex}`);
  }

  await hostPage.getByRole('button', { name: '开始游戏' }).click();
  const getRuleDialog = (playerPage) =>
    playerPage.getByRole('dialog', { name: '选择本局特殊规则' });
  await expect.poll(async () => {
    const visible = await Promise.all(pages.map((playerPage) =>
      getRuleDialog(playerPage).isVisible().catch(() => false)
    ));
    return visible.filter(Boolean).length;
  }).toBe(pages.length);

  let chooserPage = null;
  for (const playerPage of pages) {
    const targetOption = getRuleDialog(playerPage).locator('.rule-option', { hasText: targetRuleName });
    if (await targetOption.isEnabled().catch(() => false)) {
      chooserPage = playerPage;
      break;
    }
  }
  expect(chooserPage).not.toBeNull();
  const targetOption = getRuleDialog(chooserPage).locator('.rule-option', { hasText: targetRuleName });
  await expect(targetOption).toHaveCount(1);
  await targetOption.click();
  return { context, pages };
}

async function openTestModeGame(browser, ruleName, { initialHandCount = 25 } = {}) {
  const context = await browser.newContext();
  const hostPage = await context.newPage();
  const roomId = await createRoom(hostPage, `${ruleName}测试房`, { testRuleName: ruleName });
  const pages = [hostPage];

  for (let playerIndex = 2; playerIndex <= 4; playerIndex += 1) {
    const playerPage = await context.newPage();
    pages.push(playerPage);
    await joinRoom(playerPage, roomId, `玩家${playerIndex}`);
  }

  await hostPage.getByRole('button', { name: '开始游戏' }).click();
  await Promise.all(pages.map(async (playerPage) => {
    await expect(playerPage.locator('.game-table').getByText(ruleName, { exact: true })).toBeVisible();
    await expect(playerPage.getByRole('dialog', { name: '选择本局特殊规则' })).toHaveCount(0);
    await playerPage.getByRole('button', { name: /准\s*备/ }).click();
    await expect(playerPage.locator('.my-hand .card')).toHaveCount(initialHandCount, { timeout: 15_000 });
  }));
  return { context, pages };
}

async function finishDealerBury(pages, { initialHandCount = 25, bottomCardsCount = 8 } = {}) {
  let dealerPageIndex = -1;
  await expect.poll(async () => {
    for (let index = 0; index < pages.length; index += 1) {
      if (await pages[index].locator('.player-bottom').getByText('庄', { exact: true }).isVisible().catch(() => false)) {
        return index;
      }
    }
    return -1;
  }, { timeout: 25_000 }).toBeGreaterThanOrEqual(0);

  for (let index = 0; index < pages.length; index += 1) {
    if (await pages[index].locator('.player-bottom').getByText('庄', { exact: true }).isVisible().catch(() => false)) {
      dealerPageIndex = index;
      break;
    }
  }

  const dealerPage = pages[dealerPageIndex];
  const dealerCards = dealerPage.locator('.my-hand .card');
  await expect(dealerCards).toHaveCount(initialHandCount + bottomCardsCount);
  for (let cardIndex = 0; cardIndex < bottomCardsCount; cardIndex += 1) {
    await dealerCards.nth(cardIndex).dispatchEvent('click');
  }
  await dealerPage.getByRole('button', {
    name: `埋底(${bottomCardsCount}/${bottomCardsCount})`
  }).click();
  await expect(dealerPage.locator('.player-bottom.current-turn')).toBeVisible();
  await Promise.all(pages.map(async (playerPage, pageIndex) => {
    const indicator = playerPage.locator('.player-area.current-turn .turn-indicator');
    await expect(indicator).toHaveCount(1);
    await expect(indicator).toHaveText(pageIndex === dealerPageIndex ? '轮到你' : '出牌中');
  }));
  return dealerPageIndex;
}

test('返回房间会保留座位，并可选择重返牌局或确认退出', async ({ browser }, testInfo) => {
  test.setTimeout(120_000);
  const roomName = '世事无常测试房';
  const { context, pages } = await openTestModeGame(browser, '世事无常');
  const hostPage = pages[0];

  try {
    await hostPage.getByRole('button', { name: '返回房间', exact: true }).click();

    await expect(hostPage.getByRole('heading', { name: `房间: ${roomName}` })).toBeVisible();
    await expect(hostPage.getByRole('region', { name: '牌局进行中' })).toBeVisible();
    await expect(hostPage.getByText('玩家数: 4 / 4')).toBeVisible();
    await expect(hostPage.getByRole('button', { name: '重返牌局' })).toBeVisible();
    await expect(hostPage.getByRole('button', { name: '退出房间' })).toBeVisible();
    await expect(hostPage.getByRole('button', { name: '添加Bot' })).toHaveCount(0);
    const roomPageMetrics = await hostPage.evaluate(() => {
      const root = document.querySelector('#root');
      const layout = document.querySelector('.room-overview-layout');
      const card = document.querySelector('.room-overview-card');
      return {
        documentHeight: document.documentElement.scrollHeight,
        rootHeight: root?.getBoundingClientRect().height || 0,
        layoutBottom: layout?.getBoundingClientRect().bottom || 0,
        cardBottom: card?.getBoundingClientRect().bottom || 0,
        rootBackground: getComputedStyle(root).backgroundColor
      };
    });
    expect(roomPageMetrics.rootHeight).toBeGreaterThanOrEqual(roomPageMetrics.documentHeight - 1);
    expect(roomPageMetrics.layoutBottom).toBeGreaterThanOrEqual(roomPageMetrics.cardBottom);
    expect(roomPageMetrics.rootBackground).toBe('rgb(243, 246, 245)');
    await hostPage.screenshot({
      path: testInfo.outputPath('active-game-room-overview.png'),
      fullPage: true
    });

    await hostPage.getByRole('button', { name: '重返牌局' }).click();
    await expect(hostPage.locator('.game-table')).toBeVisible();
    await expect(hostPage.getByRole('button', { name: '返回房间', exact: true })).toBeVisible();

    await hostPage.getByRole('button', { name: '返回房间', exact: true }).click();
    await hostPage.getByRole('button', { name: '退出房间' }).click();
    const leaveDialog = hostPage.getByRole('dialog', { name: '确定退出房间？' });
    await expect(leaveDialog).toContainText('这会立即释放你的座位，并终止当前牌局');
    await leaveDialog.getByRole('button', { name: '保留座位' }).click();
    await expect(hostPage.getByRole('button', { name: '重返牌局' })).toBeVisible();

    await hostPage.getByRole('button', { name: '退出房间' }).click();
    await hostPage
      .getByRole('dialog', { name: '确定退出房间？' })
      .getByRole('button', { name: '确认退出' })
      .click();
    await expect(hostPage.getByRole('heading', { name: '欢迎来到拖拉机纸牌游戏' })).toBeVisible();
  } finally {
    await context.close();
  }
});

test('轮到自己时返回房间再重返会恢复本墩牌面并可继续跟牌', async ({ browser }) => {
  test.setTimeout(180_000);
  const { context, pages } = await openTestModeGame(browser, '世事无常');

  try {
    const leaderIndex = await finishDealerBury(pages);
    const followerIndex = (leaderIndex + 1) % pages.length;
    const leaderPage = pages[leaderIndex];
    const followerPage = pages[followerIndex];

    await playLegalSingle(leaderPage);
    await expect(followerPage.locator('.player-bottom.current-turn')).toBeVisible();
    await expect(followerPage.locator('.played-cards-area.has-cards')).toHaveCount(1);

    await followerPage.getByRole('button', { name: '返回房间', exact: true }).click();
    await expect(followerPage.getByRole('button', { name: '重返牌局' })).toBeVisible();
    await followerPage.getByRole('button', { name: '重返牌局' }).click();

    await expect(followerPage.locator('.player-bottom.current-turn')).toBeVisible();
    await expect(followerPage.locator('.played-cards-area.has-cards')).toHaveCount(1);
    await expect(followerPage.locator('.my-hand .card:not(.disabled)').first()).toHaveCSS(
      'cursor',
      'pointer'
    );

    const playButton = followerPage.getByRole('button', { name: /^出牌\(\d+\)$/ });
    if (!(await playButton.isEnabled())) {
      await selectLegalCard(followerPage.locator('.my-hand .card'), playButton);
    }
    await expect(playButton).toBeEnabled();
    await playButton.click();
    await expect(followerPage.locator('.played-cards-area.has-cards')).toHaveCount(2);
  } finally {
    await context.close();
  }
});

test('mobile portrait prompts rotation and landscape keeps the full hand inside the table', async ({ browser }, testInfo) => {
  test.setTimeout(120_000);
  const { context, pages } = await openTestModeGame(browser, '世事无常');
  const page = pages[0];

  try {
    await page.setViewportSize({ width: 390, height: 844 });
    const orientationGuard = page.getByTestId('portrait-orientation-guard');
    await expect(orientationGuard).toBeVisible();
    await expect(orientationGuard.getByText('请横屏游戏', { exact: true })).toBeVisible();
    await expect(orientationGuard.getByRole('button', { name: '尝试进入横屏' })).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath('mobile-portrait-rotation-guard.png') });

    await page.setViewportSize({ width: 667, height: 375 });
    await expect(orientationGuard).toBeHidden();
    await expect(page.locator('.my-hand .card')).toHaveCount(25);
    await expect(page.getByRole('button', { name: '全选', exact: true })).toHaveCount(0);

    await page.evaluate(async () => {
      const { useGameStore } = await import('/src/store/gameStore.js');
      const state = useGameStore.getState();
      useGameStore.setState({
        currentRoom: {
          ...state.currentRoom,
          gameState: {
            ...state.currentRoom.gameState,
            attackerScore: 15,
            collectedPointCards: [
              { id: 'mobile-score-five', suit: 'hearts', rank: '5' },
              { id: 'mobile-score-ten', suit: 'clubs', rank: '10' },
              { id: 'mobile-score-king', suit: 'diamonds', rank: 'K' }
            ]
          }
        }
      });
    });

    const mobileScoreTrigger = page.locator('.mobile-score-panel-trigger');
    await expect(mobileScoreTrigger).toBeVisible();
    await expect(mobileScoreTrigger).toContainText('分牌3');
    await mobileScoreTrigger.click();
    const mobileScoreDialog = page.getByRole('dialog', { name: '计分详情' });
    await expect(mobileScoreDialog).toBeVisible();
    await expect.poll(async () => (await mobileScoreDialog.boundingBox())?.width || 0).toBeGreaterThan(400);
    await expect(mobileScoreDialog.getByText('15 分', { exact: true })).toBeVisible();
    await expect(mobileScoreDialog.locator('.score-card-list .card')).toHaveCount(3);
    const scoreDialogGeometry = await mobileScoreDialog.evaluate((element) => {
      const box = element.getBoundingClientRect();
      const cardList = element.querySelector('.score-card-list');
      return {
        top: box.top,
        right: box.right,
        bottom: box.bottom,
        left: box.left,
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
        cardListOverflowX: cardList ? getComputedStyle(cardList).overflowX : null
      };
    });
    expect(scoreDialogGeometry.left).toBeGreaterThanOrEqual(0);
    expect(scoreDialogGeometry.top).toBeGreaterThanOrEqual(0);
    expect(scoreDialogGeometry.right).toBeLessThanOrEqual(scoreDialogGeometry.viewportWidth + 1);
    expect(scoreDialogGeometry.bottom).toBeLessThanOrEqual(scoreDialogGeometry.viewportHeight + 1);
    expect(scoreDialogGeometry.cardListOverflowX).toBe('auto');
    await mobileScoreDialog.screenshot({ path: testInfo.outputPath('mobile-score-details.png') });
    await mobileScoreDialog.locator('.ant-modal-close').click();
    await expect(mobileScoreDialog).toBeHidden();

    const mobileRuleDescription = page.locator('.table-rule-description');
    await expect(mobileRuleDescription).toBeVisible();
    await expect(mobileRuleDescription).not.toHaveText('');
    const mobileRuleDescriptionStyle = await mobileRuleDescription.evaluate((element) => {
      const style = getComputedStyle(element);
      return {
        display: style.display,
        overflowY: style.overflowY,
        maxHeight: style.maxHeight
      };
    });
    expect(mobileRuleDescriptionStyle.display).toBe('block');
    expect(mobileRuleDescriptionStyle.overflowY).toBe('auto');
    expect(mobileRuleDescriptionStyle.maxHeight).toBe('43px');

    const geometry = await page.evaluate(() => {
      const rect = (selector, last = false) => {
        const elements = document.querySelectorAll(selector);
        const element = last ? elements[elements.length - 1] : elements[0];
        if (!element) return null;
        const box = element.getBoundingClientRect();
        return {
          top: box.top,
          right: box.right,
          bottom: box.bottom,
          left: box.left,
          width: box.width,
          height: box.height
        };
      };
      return {
        viewport: { width: window.innerWidth, height: window.innerHeight },
        documentWidth: document.documentElement.scrollWidth,
        documentHeight: document.documentElement.scrollHeight,
        table: rect('.game-table'),
        bottomPlayer: rect('.player-bottom'),
        hand: rect('.my-hand'),
        firstCard: rect('.my-hand .card'),
        lastCard: rect('.my-hand .card', true),
        controls: rect('.inline-controls')
      };
    });

    expect(geometry.documentWidth).toBeLessThanOrEqual(geometry.viewport.width + 1);
    expect(geometry.documentHeight).toBeLessThanOrEqual(geometry.viewport.height + 1);
    expect(geometry.table.top).toBeGreaterThanOrEqual(0);
    expect(geometry.table.bottom).toBeLessThanOrEqual(geometry.viewport.height + 1);
    expect(geometry.bottomPlayer.bottom).toBeLessThanOrEqual(geometry.viewport.height + 1);
    expect(geometry.hand.bottom).toBeLessThanOrEqual(geometry.viewport.height + 1);
    expect(geometry.firstCard.left).toBeGreaterThanOrEqual(0);
    expect(geometry.lastCard.right).toBeLessThanOrEqual(geometry.viewport.width + 1);
    expect(geometry.firstCard.height).toBeGreaterThanOrEqual(108);
    expect(geometry.controls.bottom).toBeLessThanOrEqual(geometry.viewport.height + 1);

    await page.screenshot({ path: testInfo.outputPath('mobile-landscape-table.png') });

    await finishDealerBury(pages);
    await expect(page.getByRole('button', { name: '全选', exact: true })).toHaveCount(0);
    await page.evaluate(async () => {
      const { useGameStore } = await import('/src/store/gameStore.js');
      const socketService = (await import('/src/services/socket.js')).default;
      const state = useGameStore.getState();
      socketService.socket.listeners('cards_played').forEach(listener => listener({
        playerId: state.currentPlayer.id,
        playerName: state.currentPlayer.name,
        cards: [{ id: 'mobile-round-score-card', suit: 'hearts', rank: '10' }],
        cardsCount: 1,
        remainingCount: Math.max(0, (state.currentPlayer.cardsCount || 25) - 1)
      }));
    });

    const roundPoints = page.locator('.mobile-round-points-indicator');
    await expect(roundPoints).toBeVisible();
    const playingGeometry = await page.evaluate(() => {
      const rect = selector => {
        const element = document.querySelector(selector);
        if (!element) return null;
        const box = element.getBoundingClientRect();
        return { top: box.top, right: box.right, bottom: box.bottom, left: box.left };
      };
      const overlaps = (first, second) => Boolean(
        first && second
        && first.left < second.right
        && first.right > second.left
        && first.top < second.bottom
        && first.bottom > second.top
      );
      const score = rect('.score-panel');
      const points = rect('.mobile-round-points-indicator');
      const playedAreas = ['top', 'right', 'bottom', 'left']
        .map(position => rect(`.played-cards-${position}.has-cards`))
        .filter(Boolean);
      return {
        score,
        points,
        pointsOverlapScore: overlaps(points, score),
        pointsOverlapPlayedCards: playedAreas.some(area => overlaps(points, area))
      };
    });
    expect(playingGeometry.pointsOverlapScore).toBe(true);
    expect(playingGeometry.pointsOverlapPlayedCards).toBe(false);
    expect(playingGeometry.points.left).toBeGreaterThanOrEqual(playingGeometry.score.left - 1);
    expect(playingGeometry.points.right).toBeLessThanOrEqual(playingGeometry.score.right + 1);
    expect(playingGeometry.points.top).toBeGreaterThanOrEqual(playingGeometry.score.top - 1);
    expect(playingGeometry.points.bottom).toBeLessThanOrEqual(playingGeometry.score.bottom + 1);
    await page.screenshot({ path: testInfo.outputPath('mobile-landscape-round-score.png') });
  } finally {
    await context.close();
  }
});

test('mobile landscape keeps an active skill and all core actions inside the control bar', async ({ browser }) => {
  test.setTimeout(120_000);
  const { context, pages } = await openTestModeGame(browser, '时间倒流');

  try {
    await Promise.all(pages.map(page => page.setViewportSize({ width: 667, height: 375 })));
    const dealerPageIndex = await finishDealerBury(pages);
    const dealerPage = pages[dealerPageIndex];

    await expect(dealerPage.locator('.active-skill-button')).toBeVisible();
    await expect(dealerPage.getByRole('button', { name: '全选', exact: true })).toHaveCount(0);

    const controlsGeometry = await dealerPage.locator('.inline-controls').evaluate((element) => ({
      clientWidth: element.clientWidth,
      scrollWidth: element.scrollWidth,
      viewportWidth: window.innerWidth,
      right: element.getBoundingClientRect().right
    }));
    expect(controlsGeometry.scrollWidth).toBeLessThanOrEqual(controlsGeometry.clientWidth + 1);
    expect(controlsGeometry.right).toBeLessThanOrEqual(controlsGeometry.viewportWidth + 1);
  } finally {
    await context.close();
  }
});

test('mobile landscape reserves a separate dock for public center cards', async ({ browser }, testInfo) => {
  test.setTimeout(120_000);
  const { context, pages } = await openTestModeGame(browser, '第二战场');
  const page = pages[0];

  try {
    await finishDealerBury(pages);
    await page.setViewportSize({ width: 667, height: 375 });

    const tray = page.getByTestId('second-battlefield-tray');
    await expect(tray).toBeVisible();
    await expect(tray.locator('.second-battlefield-card-row .card')).toHaveCount(5);

    const geometry = await page.evaluate(() => {
      const rect = selector => {
        const element = document.querySelector(selector);
        if (!element) return null;
        const box = element.getBoundingClientRect();
        return { top: box.top, right: box.right, bottom: box.bottom, left: box.left };
      };
      const overlaps = (first, second) => Boolean(
        first && second
        && first.left < second.right
        && first.right > second.left
        && first.top < second.bottom
        && first.bottom > second.top
      );
      const centerTray = rect('.second-battlefield-tray');
      const bottomPlayer = rect('.player-bottom');
      return {
        viewport: { width: window.innerWidth, height: window.innerHeight },
        table: rect('.game-table'),
        centerTray,
        bottomPlayer,
        overlapsBottomPlayer: overlaps(centerTray, bottomPlayer),
        overlapsScore: overlaps(centerTray, rect('.score-panel')),
        overlapsRules: overlaps(centerTray, rect('.center-content.table-tools'))
      };
    });

    expect(geometry.centerTray.left).toBeGreaterThanOrEqual(geometry.table.left);
    expect(geometry.centerTray.right).toBeLessThanOrEqual(geometry.table.right);
    expect(geometry.centerTray.top).toBeGreaterThanOrEqual(geometry.table.top);
    expect(geometry.centerTray.bottom).toBeLessThanOrEqual(geometry.bottomPlayer.top + 1);
    expect(geometry.overlapsBottomPlayer).toBe(false);
    expect(geometry.overlapsScore).toBe(false);
    expect(geometry.overlapsRules).toBe(false);
    await page.screenshot({ path: testInfo.outputPath('mobile-landscape-center-card-dock.png') });
  } finally {
    await context.close();
  }
});

test('路线摇摆和昼夜轮转状态独占一行', async ({ browser }, testInfo) => {
  test.setTimeout(180_000);

  const routeGame = await openTestModeGame(browser, '路线摇摆');
  try {
    await Promise.all(routeGame.pages.map(page => page.setViewportSize({ width: 1440, height: 900 })));
    await finishDealerBury(routeGame.pages);
    await Promise.all(routeGame.pages.map(async page => {
      const status = page.getByTestId('route-direction-status');
      await expect(status).toBeVisible();
      await expect(status).toContainText('当前：逆时针');
      await expect(status).toHaveAttribute('data-direction', 'counter-clockwise');
      const description = page.getByText(
        '有单张价值不小于10分的牌被打出的轮次结束后，顺时针与逆时针出牌顺序互换。',
        { exact: true }
      );
      await expect(description).toBeVisible();
      const [statusBox, descriptionBox] = await Promise.all([
        status.boundingBox(),
        description.boundingBox()
      ]);
      expect(descriptionBox.y).toBeGreaterThanOrEqual(statusBox.y + statusBox.height - 1);
    }));
    await routeGame.pages[0].locator('.game-table').screenshot({
      path: testInfo.outputPath('route-swing-direction-status.png')
    });
  } finally {
    await routeGame.context.close();
  }

  const dayNightGame = await openTestModeGame(browser, '昼夜轮转');
  try {
    await Promise.all(dayNightGame.pages.map(page => page.setViewportSize({ width: 1440, height: 900 })));
    await finishDealerBury(dayNightGame.pages);
    await Promise.all(dayNightGame.pages.map(async page => {
      const status = page.getByTestId('day-night-rank-status');
      await expect(status).toBeVisible();
      await expect(status).toContainText('第1轮');
      // 首局级牌为2，第1轮本应轮到2，因此跳过提升并显示普通牌A最大。
      await expect(status).toContainText('当前最大点数：A');
      await expect(status).toHaveAttribute('data-round', '1');
      await expect(status).toHaveAttribute('data-highest-rank', 'A');
      const description = page.getByText(
        '第x轮将点数x % 13 + 1提升为相应花色内最大，其他牌序不变；若轮转到级牌则仍按A最大。闲家开局为20分。',
        { exact: true }
      );
      await expect(description).toBeVisible();
      const [statusBox, descriptionBox] = await Promise.all([
        status.boundingBox(),
        description.boundingBox()
      ]);
      expect(descriptionBox.y).toBeGreaterThanOrEqual(statusBox.y + statusBox.height - 1);
    }));
    await dayNightGame.pages[0].locator('.game-table').screenshot({
      path: testInfo.outputPath('day-night-highest-rank-status.png')
    });
  } finally {
    await dayNightGame.context.close();
  }
});

test('计划经济埋底前封存20张，第一轮结束后四家各摸1张并播放动画', async ({ browser }, testInfo) => {
  test.setTimeout(150_000);
  const { context, pages } = await openTestModeGame(browser, '计划经济', {
    initialHandCount: 20
  });

  try {
    await Promise.all(pages.map(page => page.setViewportSize({ width: 1440, height: 900 })));
    await Promise.all(pages.map(async page => {
      const status = page.getByTestId('planned-economy-status');
      await expect(status).toContainText('20 / 20');
      await expect(status).toContainText('埋底完成前不摸牌');
      await expect(page.locator('.my-hand .card')).toHaveCount(20);
    }));

    await finishDealerBury(pages, { initialHandCount: 20 });
    await Promise.all(pages.map(async page => {
      await expect(page.getByTestId('planned-economy-status')).toContainText('每轮结束四家各摸1张');
      await expect(page.locator('.my-hand .card')).toHaveCount(20);
    }));

    for (let playIndex = 0; playIndex < 4; playIndex += 1) {
      let turnPage = null;
      await expect.poll(async () => {
        for (const page of pages) {
          if (await page.locator('.player-bottom.current-turn').isVisible().catch(() => false)) {
            turnPage = page;
            return true;
          }
        }
        return false;
      }).toBe(true);
      await playLegalSingle(turnPage);
    }

    const drawLayer = pages[0].locator('.planned-economy-draw-layer');
    await expect(drawLayer).toBeVisible();
    await expect(drawLayer.locator('.exchange-flying-card')).toHaveCount(4);
    await expect(drawLayer).toContainText('第1轮补牌 · 剩余16张');
    await pages[0].locator('.game-table').screenshot({
      path: testInfo.outputPath('planned-economy-round-draw.png')
    });
    await expect(drawLayer).toBeHidden({ timeout: 5_000 });

    await Promise.all(pages.map(async page => {
      await expect(page.locator('.my-hand .card')).toHaveCount(20);
      await expect(page.getByTestId('planned-economy-status')).toContainText('16 / 20');
    }));
  } finally {
    await context.close();
  }
});

test('等价互惠由一号位点选玩家、双方暗选拼点牌并完成交换', async ({ browser }, testInfo) => {
  test.setTimeout(150_000);
  const { context, pages } = await openTestModeGame(browser, '等价互惠');

  try {
    await Promise.all(pages.map(page => page.setViewportSize({ width: 1440, height: 900 })));
    const firstPlayerIndex = await finishDealerBury(pages);
    const targetPlayerIndex = (firstPlayerIndex + 1) % 4;
    const firstPlayerPage = pages[firstPlayerIndex];
    const targetPlayerPage = pages[targetPlayerIndex];
    const skillButton = firstPlayerPage.getByRole('button', { name: '等价互惠', exact: true });

    await expect(skillButton).toBeEnabled();
    await expect(skillButton).toHaveClass(/is-ready/);
    await skillButton.click();
    await expect(skillButton).toHaveClass(/is-armed/);
    await expect(firstPlayerPage.locator('.player-area.skill-targetable')).toHaveCount(3);

    await firstPlayerPage.locator('.player-right.skill-targetable').click();
    const confirmation = firstPlayerPage.getByRole('dialog', { name: '等价互惠', exact: true });
    await expect(confirmation).toBeVisible();
    await expect(confirmation).toContainText('主牌大于副牌');
    await confirmation.getByRole('button', { name: '否，重新选择', exact: true }).click();
    await expect(skillButton).toBeEnabled();
    await expect(skillButton).toHaveClass(/is-armed/);

    await firstPlayerPage.locator('.player-right.skill-targetable').click();
    await confirmation.getByRole('button', { name: '是，与其拼点', exact: true }).click();

    const firstSelection = firstPlayerPage.getByRole('dialog', { name: '等价互惠 · 选择拼点牌' });
    const targetSelection = targetPlayerPage.getByRole('dialog', { name: '等价互惠 · 选择拼点牌' });
    await expect(firstSelection).toBeVisible();
    await expect(targetSelection).toBeVisible();
    const firstCard = firstSelection.locator('.equivalent-reciprocity-hand-picker .card').first();
    const targetCard = targetSelection.locator('.equivalent-reciprocity-hand-picker .card').first();
    const firstCardId = await firstCard.getAttribute('data-card-id');
    const targetCardId = await targetCard.getAttribute('data-card-id');
    await firstCard.click();
    await targetCard.click();
    await firstSelection.getByRole('button', { name: '确认拼点牌', exact: true }).click();
    await expect(firstSelection.getByRole('button', { name: '已暗置，等待对方', exact: true })).toBeDisabled();
    await targetSelection.getByRole('button', { name: '确认拼点牌', exact: true }).click();

    await Promise.all(pages.map(async page => {
      const result = page.locator('.equivalent-reciprocity-result');
      await expect(result).toBeVisible();
      await expect(result.locator('.card')).toHaveCount(2);
      await expect(page.locator('.card-exchange-animation-layer .exchange-flying-card')).toHaveCount(2);
    }));
    await firstPlayerPage.locator('.game-table').screenshot({
      path: testInfo.outputPath('equivalent-reciprocity-reveal-and-exchange.png')
    });

    await expect(firstPlayerPage.locator(`.my-hand [data-card-id="${targetCardId}"]`)).toHaveCount(1, { timeout: 5_000 });
    await expect(targetPlayerPage.locator(`.my-hand [data-card-id="${firstCardId}"]`)).toHaveCount(1, { timeout: 5_000 });
    await expect(skillButton).toBeDisabled();
    await expect(skillButton).toHaveClass(/is-used/);
  } finally {
    await context.close();
  }
});

test('一带一路未发动时可尝试普通甩牌，发动后切换为小甩牌', async ({ browser }, testInfo) => {
  test.setTimeout(120_000);
  const beltAndRoadGame = await openTestModeGame(browser, '一带一路');
  try {
    await Promise.all(beltAndRoadGame.pages.map(page => page.setViewportSize({ width: 1440, height: 900 })));
    const leaderPageIndex = await finishDealerBury(beltAndRoadGame.pages);
    const leaderPage = beltAndRoadGame.pages[leaderPageIndex];
    const skillButton = leaderPage.getByRole('button', { name: '一带一路', exact: true });
    await expect(skillButton).toBeVisible();
    await expect(skillButton).toBeEnabled();
    await expect(skillButton).toHaveAttribute('aria-pressed', 'false');

    const handCards = leaderPage.locator('.my-hand .card');
    const candidateIndexes = await handCards.evaluateAll(cards => {
      const groups = new Map();
      cards.forEach((card, index) => {
        if (card.querySelector('.trump-badge')) return;
        const suit = card.querySelector('.card-corner.top-left .card-suit')?.textContent?.trim();
        const rank = card.querySelector('.card-corner.top-left .card-rank')?.textContent?.trim();
        if (!suit || !rank) return;
        const entries = groups.get(suit) || [];
        entries.push({ index, rank });
        groups.set(suit, entries);
      });
      for (const entries of groups.values()) {
        for (let first = 0; first < entries.length; first += 1) {
          for (let second = first + 1; second < entries.length; second += 1) {
            if (entries[first].rank !== entries[second].rank) {
              return [entries[first].index, entries[second].index];
            }
          }
        }
      }
      return null;
    });
    expect(candidateIndexes).not.toBeNull();
    for (const cardIndex of candidateIndexes) {
      await handCards.nth(cardIndex).dispatchEvent('click');
    }
    await expect(leaderPage.getByRole('button', { name: '出牌(2)', exact: true })).toBeEnabled();
    await expect(skillButton).toHaveAttribute('aria-pressed', 'false');

    await skillButton.click();
    await expect(skillButton).toHaveAttribute('aria-pressed', 'true');
    await expect(skillButton).toHaveClass(/is-armed/);
    await expect(leaderPage.getByRole('button', { name: '出牌(0)', exact: true })).toBeVisible();
    await expect(leaderPage.getByRole('button', { name: /垫牌/ })).toHaveCount(0);
    for (const cardIndex of candidateIndexes) {
      await handCards.nth(cardIndex).dispatchEvent('click');
    }
    await expect(leaderPage.getByRole('button', { name: '出牌(2)', exact: true })).toBeEnabled();
    await leaderPage.locator('.game-table').screenshot({
      path: testInfo.outputPath('belt-and-road-active-skill-button.png')
    });
  } finally {
    await beltAndRoadGame.context.close();
  }
});

test('禁术秘法可由非一号位预备、轮首确认，发动后原主牌须先转成副牌', async ({ browser }, testInfo) => {
  test.setTimeout(120_000);
  const { context, pages } = await openTestModeGame(browser, '禁术秘法');

  try {
    await Promise.all(pages.map(page => page.setViewportSize({ width: 1440, height: 900 })));
    const firstPlayerIndex = await finishDealerBury(pages);
    const declarerIndex = (firstPlayerIndex + 1) % pages.length;
    const latePlayerIndex = (firstPlayerIndex + 2) % pages.length;
    const declarerPage = pages[declarerIndex];
    const skillButton = declarerPage.getByRole('button', { name: '禁术秘法', exact: true });

    await expect(declarerPage.locator('.player-bottom.current-turn')).toHaveCount(0);
    await expect(skillButton).toBeEnabled();
    await skillButton.click();
    const activationDialog = declarerPage.getByRole('dialog', {
      name: '禁术秘法',
      exact: true
    });
    await expect(activationDialog).toBeVisible();
    await expect(activationDialog.getByText(/本局结束，不能撤销/)).toBeVisible();
    await activationDialog.getByRole('button', { name: '确定发动' }).click();
    await expect(skillButton).toHaveAttribute('aria-pressed', 'true');
    await expect(skillButton).toHaveClass(/is-armed/);
    await expect(skillButton).toBeDisabled();

    await expect(declarerPage.locator('.my-hand .card.forbidden-magic-demoted')).toHaveCount(0);
    const transformableCards = declarerPage.locator(
      '.my-hand .card:has(button[aria-label="转化此牌"])'
    );
    await expect(transformableCards.first()).toBeVisible();
    const transformButton = transformableCards.first().getByRole('button', { name: '转化此牌' });
    // 手牌采用扇形叠放，按钮可能被相邻牌的透明区域覆盖；派发点击验证实际处理器。
    await transformButton.dispatchEvent('click');

    const transformDialog = declarerPage.getByRole('dialog', {
      name: '禁术秘法 · 选择目标牌面'
    });
    await expect(transformDialog).toBeVisible();
    await transformDialog.locator('.transformation-suit-option').first().click();
    if (await transformDialog.isVisible().catch(() => false)) {
      await transformDialog.locator('.transformation-rank-option').first().click({ force: true });
    }

    const transformedCard = declarerPage.locator('.my-hand .card.forbidden-magic-transformed');
    await expect(transformedCard).toHaveCount(1);
    await expect(transformedCard.getByRole('button', { name: '取消转化，还原原牌' })).toBeVisible();
    await declarerPage.locator('.game-table').screenshot({
      path: testInfo.outputPath('forbidden-magic-demotion-and-transformation.png')
    });
    await transformedCard.getByRole('button', { name: '取消转化，还原原牌' }).dispatchEvent('click');
    await expect(declarerPage.locator('.my-hand .card.forbidden-magic-transformed')).toHaveCount(0);
    await expect(transformableCards.first().getByRole('button', { name: '转化此牌' })).toBeVisible();

    await playLegalSingle(pages[firstPlayerIndex]);
    const lateSkillButton = pages[latePlayerIndex].getByRole('button', {
      name: '禁术秘法',
      exact: true
    });
    await expect(lateSkillButton).toBeEnabled();
    await lateSkillButton.click();
    await expect(lateSkillButton).toBeDisabled();
    await expect(lateSkillButton).toHaveAttribute('aria-pressed', 'true');
    await expect(lateSkillButton).toHaveAttribute('title', /第2轮开始时确认/);
  } finally {
    await context.close();
  }
});

test('规则选择发生在牌桌内，且庄家可随时查看底牌', async ({ page }, testInfo) => {
  test.setTimeout(90_000);
  const roomId = await createRoom(page);
  const pages = [page];

  for (let playerIndex = 2; playerIndex <= 4; playerIndex += 1) {
    const playerPage = await page.context().newPage();
    pages.push(playerPage);
    await joinRoom(playerPage, roomId, `玩家${playerIndex}`);
  }

  await expect(page.getByText('玩家数: 4 / 4')).toBeVisible();
  await page.getByRole('button', { name: '开始游戏' }).click();
  await Promise.all(pages.map((playerPage) =>
    expect(playerPage.locator('.game-board')).toBeVisible()
  ));

  const getRuleDialog = (playerPage) =>
    playerPage.getByRole('dialog', { name: '选择本局特殊规则' });
  await expect.poll(async () => {
    const visibleStates = await Promise.all(pages.map(async (playerPage) =>
      getRuleDialog(playerPage).isVisible().catch(() => false)
    ));
    return visibleStates.filter(Boolean).length;
  }).toBe(1);

  let chooserPage = null;
  for (const playerPage of pages) {
    if (await getRuleDialog(playerPage).isVisible().catch(() => false)) {
      chooserPage = playerPage;
      break;
    }
  }

  const ruleDialog = getRuleDialog(chooserPage);
  const ruleOptions = ruleDialog.locator('.rule-option');
  await expect(ruleOptions).toHaveCount(2);
  const ruleColumnMetrics = await ruleOptions.evaluateAll((options) => options.map((option) => {
    const nameRect = option.querySelector('.rule-option-name').getBoundingClientRect();
    const descriptionRect = option.querySelector('.rule-option-description').getBoundingClientRect();
    return { nameRight: nameRect.right, descriptionLeft: descriptionRect.left };
  }));
  expect(Math.max(...ruleColumnMetrics.map(({ nameRight }) => nameRight)) -
    Math.min(...ruleColumnMetrics.map(({ nameRight }) => nameRight))).toBeLessThan(1);
  expect(Math.max(...ruleColumnMetrics.map(({ descriptionLeft }) => descriptionLeft)) -
    Math.min(...ruleColumnMetrics.map(({ descriptionLeft }) => descriptionLeft))).toBeLessThan(1);
  await ruleDialog.locator('.ant-modal-content').screenshot({
    path: testInfo.outputPath('rule-selector-aligned.png'),
  });
  const optionNames = await ruleOptions.locator('.rule-option-name').allTextContents();
  const chosenOptionIndex = optionNames.findIndex((name) => name.trim() !== '与民同乐');
  const bottomCardsByRuleName = {
    五谷丰登: 12,
    极限挑战: 16,
    江山半壁: 4,
    与民同乐: 0
  };
  const chosenRuleName = optionNames[chosenOptionIndex].trim();
  const chosenBottomCardsCount = bottomCardsByRuleName[chosenRuleName] ?? 8;
  await ruleOptions.nth(chosenOptionIndex).click();

  await Promise.all(pages.map((playerPage) =>
    playerPage.getByRole('button', { name: /准\s*备/ }).click()
  ));
  await expect(page.locator('.my-hand .card').first()).toBeVisible({ timeout: 15_000 });

  if (openingExchangeRules[chosenRuleName]) {
    await finishOpeningExchange(pages);
  }

  let dealerPageIndex = -1;
  await expect.poll(async () => {
    for (let index = 0; index < pages.length; index += 1) {
      const dealerBadge = pages[index].locator('.player-bottom').getByText('庄', { exact: true });
      if (await dealerBadge.isVisible().catch(() => false)) return index;
    }
    return -1;
  }, { timeout: 25_000 }).toBeGreaterThanOrEqual(0);

  for (let index = 0; index < pages.length; index += 1) {
    const dealerBadge = pages[index].locator('.player-bottom').getByText('庄', { exact: true });
    if (await dealerBadge.isVisible().catch(() => false)) {
      dealerPageIndex = index;
      break;
    }
  }

  const dealerPage = pages[dealerPageIndex];
  const dealerCards = dealerPage.locator('.my-hand .card');
  const expectedDealerCardCount = ((108 - chosenBottomCardsCount) / 4) + chosenBottomCardsCount;
  await expect(dealerCards).toHaveCount(expectedDealerCardCount);
  const buryButton = dealerPage.locator('button', { hasText: '埋底(' });
  await expect(buryButton).toBeDisabled();
  expect(await buryButton.evaluate((button) => getComputedStyle(button).cursor)).toBe('default');
  for (let cardIndex = 0; cardIndex < chosenBottomCardsCount; cardIndex += 1) {
    // 手牌有意横向叠放；直接触发目标牌的点击，避免后续牌面拦截坐标点击。
    await dealerCards.nth(cardIndex).click({ force: true });
  }
  const readyBuryButton = dealerPage.locator('button', {
    hasText: `埋底(${chosenBottomCardsCount}/${chosenBottomCardsCount})`
  });
  await expect(readyBuryButton).toBeEnabled();
  await readyBuryButton.click();

  const viewBottomButton = dealerPage.getByRole('button', { name: '查看底牌' });
  await expect(viewBottomButton).toBeVisible();
  for (let index = 0; index < pages.length; index += 1) {
    if (index !== dealerPageIndex) {
      await expect(pages[index].getByRole('button', { name: '查看底牌' })).toHaveCount(0);
    }
  }

  await viewBottomButton.click();
  const bottomDialog = dealerPage.getByRole('dialog', { name: '庄家底牌' });
  await expect(bottomDialog.locator('.card')).toHaveCount(chosenBottomCardsCount);
  await expect(bottomDialog.getByText(/底牌分数：\d+ 分/)).toBeVisible();
  await expect(dealerPage.locator('.ant-message-notice')).toHaveCount(0, { timeout: 6_000 });
  await bottomDialog.locator('.ant-modal-content').screenshot({
    path: testInfo.outputPath('dealer-bottom-cards.png'),
  });
  await bottomDialog.getByRole('button', { name: /关\s*闭/ }).click();

  await Promise.all(pages.slice(1).map((playerPage) => playerPage.close()));
});

test('规则测试模式可在创建房间时直接指定规则并跳过随机二选一', async ({ page }) => {
  test.setTimeout(45_000);
  const roomName = '公开规则测试房';
  const roomId = await createRoom(page, roomName, { testRuleName: '算无遗策' });
  const pages = [page];

  for (let playerIndex = 2; playerIndex <= 4; playerIndex += 1) {
    const playerPage = await page.context().newPage();
    pages.push(playerPage);
    await joinRoom(playerPage, roomId, `玩家${playerIndex}`);
  }

  await expect(page.getByText('规则模式: 测试模式（算无遗策）')).toBeVisible();
  await page.getByRole('button', { name: '开始游戏' }).click();
  await Promise.all(pages.map(async (playerPage) => {
    await expect(playerPage.locator('.game-board')).toBeVisible();
    await expect(playerPage.locator('.game-table').getByText('算无遗策', { exact: true })).toBeVisible();
    await expect(playerPage.getByRole('dialog', { name: '选择本局特殊规则' })).toHaveCount(0);
  }));

  await Promise.all(pages.slice(1).map((playerPage) => playerPage.close()));
});

test('近期实现规则均可在规则测试模式中直接选择', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: '创建房间' }).click();
  const dialog = page.getByRole('dialog', { name: '创建房间' });
  await dialog.getByRole('checkbox', { name: '规则测试模式' }).check();

  for (const ruleName of [
    '势如破竹',
    '单步调试',
    '改革开放',
    '李代桃僵',
    '六六大顺',
    '太极四象',
    '一马当先',
    '迷雾重重',
    '暗度陈仓',
    '红颜祸水',
    '偷梁换柱',
    '斗转星移',
    '绝处逢生',
    '后发制人',
    '随波逐流',
    '频繁波动',
    '微小扰动',
    '弃掷逦迤',
    '礼崩乐坏',
    '举贤任能',
    '意外保险',
    '三权分立',
    '君子一言',
    '再衰三竭',
    '焦点人物',
    '冷却时间',
    '时间冷却',
    '平均池化',
    '梦中杀人',
    '珠联璧合',
    '神兵天降',
    '魔术戏法',
    '戛然而止',
    '聚类分析',
    '无独有偶',
    '政治审查',
    '无人生还',
    '调虎离山'
  ]) {
    await dialog.locator('.ant-select-selector').click();
    const ruleInput = dialog.getByLabel('测试规则');
    await ruleInput.fill(ruleName);
    const option = page.locator('.ant-select-dropdown:visible').getByText(ruleName, { exact: true });
    await expect(option).toBeVisible();
    await option.click();
    await expect(dialog.locator('.ant-select-selection-item')).toHaveText(ruleName);
    await ruleInput.fill('');
  }
});

test('请君入瓮、老骥伏枥和Trump wins可在规则测试模式中直接选择', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: '创建房间' }).click();
  const dialog = page.getByRole('dialog', { name: '创建房间' });
  await dialog.getByRole('checkbox', { name: '规则测试模式' }).check();

  for (const ruleName of ['请君入瓮', '老骥伏枥', 'Trump wins']) {
    await dialog.locator('.ant-select-selector').click();
    const ruleInput = dialog.getByLabel('测试规则');
    await ruleInput.fill(ruleName);
    const option = page.locator('.ant-select-dropdown:visible').getByText(ruleName, { exact: true });
    await expect(option).toBeVisible();
    await option.click();
    await expect(dialog.locator('.ant-select-selection-item')).toHaveText(ruleName);
    await ruleInput.fill('');
  }
});

test('魔术戏法只能暗选两名其他玩家，选择只回执给发动者', async ({ browser }, testInfo) => {
  test.setTimeout(120_000);
  const { context, pages } = await openTestModeGame(browser, '魔术戏法');

  try {
    const firstPlayerIndex = await finishDealerBury(pages);
    const firstPlayerPage = pages[firstPlayerIndex];
    const skillButton = firstPlayerPage.getByRole('button', { name: '魔术戏法', exact: true });
    await expect(skillButton).toBeEnabled();
    await skillButton.click();

    await expect(firstPlayerPage.locator('.player-bottom.skill-targetable')).toHaveCount(0);
    const firstTarget = firstPlayerPage.locator('.player-top.skill-targetable');
    const secondTarget = firstPlayerPage.locator('.player-right.skill-targetable');
    await expect(firstTarget).toBeVisible();
    await expect(secondTarget).toBeVisible();
    await firstTarget.click();
    await secondTarget.click();

    const confirmation = firstPlayerPage.getByRole('dialog', { name: '魔术戏法', exact: true });
    await expect(confirmation).toBeVisible();
    await confirmation.getByRole('button', { name: '确认暗选' }).click();
    await expect(firstPlayerPage.getByText(/魔术戏法已暗中准备/)).toBeVisible();
    await expect(firstPlayerPage.locator('.active-skill-button.is-armed')).toHaveText('魔术戏法');

    await Promise.all(pages.map(async (playerPage, pageIndex) => {
      if (pageIndex === firstPlayerIndex) return;
      await expect(playerPage.getByText(/魔术戏法已暗中准备/)).toHaveCount(0);
    }));
  } finally {
    await context.close();
    await testInfo.attach('魔术戏法-暗选完成', {
      body: Buffer.from('发动者只能选择两名其他玩家，未向其他客户端泄露暗选。'),
      contentType: 'text/plain'
    });
  }
});

test('聚类分析把转化编辑与正常选牌分离，熄灭技能后仍可逐张还原', async ({ browser }) => {
  test.setTimeout(120_000);
  const { context, pages } = await openTestModeGame(browser, '聚类分析');

  try {
    const firstPlayerIndex = await finishDealerBury(pages);
    const firstPlayerPage = pages[firstPlayerIndex];
    await firstPlayerPage
      .getByRole('button', { name: '聚类分析', exact: true })
      .dispatchEvent('click');

    const injectedCardIds = await firstPlayerPage.evaluate(async () => {
      const socketService = (await import('/src/services/socket.js')).default;
      const cards = [
        ...[0, 1].map(copyIndex => ({
          id: `cluster-heart-j-${copyIndex}`,
          suit: 'hearts',
          rank: 'J',
          copyIndex
        })),
        { id: 'cluster-original-heart-q', suit: 'hearts', rank: 'Q', copyIndex: 0 },
        { id: 'cluster-original-heart-k', suit: 'hearts', rank: 'K', copyIndex: 0 }
      ];
      const listeners = socketService.socket.listeners('card_dealt');
      cards.forEach(card => listeners.forEach(listener => listener({ card })));
      return {
        sourceCardIds: cards.slice(0, 2).map(card => card.id),
        originalQId: cards[2].id,
        originalKId: cards[3].id
      };
    });

    const dialog = firstPlayerPage.getByRole('dialog', { name: '聚类分析 · 选择目标点数' });
    for (const sourceCardId of injectedCardIds.sourceCardIds) {
      await firstPlayerPage
        .locator(`.my-hand .card[data-card-id="${sourceCardId}"]`)
        .getByRole('button', { name: '转化此牌' })
        .click();
      await expect(dialog).toBeVisible();
      await dialog.getByRole('button', { name: 'Q', exact: true }).click();
    }

    const transformedCards = firstPlayerPage.locator('.my-hand .card.cluster-analysis-transformed');
    await expect(transformedCards).toHaveCount(2);
    await expect(firstPlayerPage.locator('.my-hand .card.selected')).toHaveCount(0);

    // 技能仍点亮时，点牌面只做正常选牌；原生 Q 不得再被强制打开 Q→J 的转化框。
    await firstPlayerPage
      .locator(`.my-hand .card[data-card-id="${injectedCardIds.sourceCardIds[0]}"]`)
      .click({ position: { x: 8, y: 18 } });
    await firstPlayerPage
      .locator(`.my-hand .card[data-card-id="${injectedCardIds.originalQId}"]`)
      .click({ position: { x: 8, y: 18 } });
    await expect(firstPlayerPage.locator('.my-hand .card.selected')).toHaveCount(2);
    await expect(dialog).toBeHidden();

    // 熄灭按钮只退出转化编辑，不清空牌面转化和已经选择的牌。
    await firstPlayerPage
      .getByRole('button', { name: '聚类分析', exact: true })
      .dispatchEvent('click');
    await expect(transformedCards).toHaveCount(2);
    await expect(firstPlayerPage.locator('.my-hand .card.selected')).toHaveCount(2);
    await firstPlayerPage
      .locator(`.my-hand .card[data-card-id="${injectedCardIds.originalKId}"]`)
      .click({ position: { x: 8, y: 18 } });
    await expect(firstPlayerPage.locator('.my-hand .card.selected')).toHaveCount(3);

    await firstPlayerPage
      .locator(`.my-hand .card[data-card-id="${injectedCardIds.sourceCardIds[0]}"]`)
      .getByRole('button', { name: '取消转化' })
      .click();
    await expect(transformedCards).toHaveCount(1);
    await firstPlayerPage
      .locator(`.my-hand .card[data-card-id="${injectedCardIds.sourceCardIds[1]}"]`)
      .getByRole('button', { name: '取消转化' })
      .click();
    await expect(transformedCards).toHaveCount(0);
    await expect(firstPlayerPage.locator('.my-hand .card.selected')).toHaveCount(2);
  } finally {
    await context.close();
  }
});

test('戛然而止结算展示庄家最后全部四张手牌且不溢出', async ({ browser }, testInfo) => {
  test.setTimeout(120_000);
  const { context, pages } = await openTestModeGame(browser, '戛然而止');

  try {
    await finishDealerBury(pages);
    const settlementPage = pages[0];
    await settlementPage.evaluate(async () => {
      const socketService = (await import('/src/services/socket.js')).default;
      const viewerSocketId = socketService.socket.id;
      const room = {
        id: 'abrupt-stop-e2e-room',
        name: '戛然而止测试房',
        hostId: viewerSocketId,
        config: { bottomCardsCount: 8 },
        players: [0, 1, 2, 3].map(index => ({
          id: `abrupt-player-${index}`,
          socketId: index === 0 ? viewerSocketId : `other-socket-${index}`,
          name: index === 0 ? '庄家' : `玩家${index + 1}`,
          level: 2,
          cardsCount: 0
        })),
        gameState: {
          phase: 'revealing',
          selectedRule: {
            id: 'abrupt_stop',
            name: '戛然而止',
            content: '完整轮结束后检查终局。'
          },
          trumpSuit: 'no_trump',
          trumpRank: '2',
          team1Level: 2,
          team2Level: 2,
          dealerPlayerIndex: 0,
          currentPlayerIndex: 0,
          attackerScore: 47.5
        }
      };
      socketService.socket.listeners('room_updated').forEach(listener => listener({ room }));
    });
    await expect(settlementPage.locator('.game-table')).toBeVisible();
    await expect.poll(() => settlementPage.evaluate(async () => {
      const socketService = (await import('/src/services/socket.js')).default;
      return socketService.socket.listeners('bottom_revealed').length;
    })).toBeGreaterThan(0);
    await settlementPage.evaluate(async () => {
      const socketService = (await import('/src/services/socket.js')).default;
      const bottomCards = ['3', '4', '6', '7', '8', '9', 'J', 'Q'].map((rank, index) => ({
        id: `abrupt-bottom-${index}`,
        suit: index < 4 ? 'diamonds' : 'clubs',
        rank,
        copyIndex: index
      }));
      const dealerRemainingCards = ['K', '5', '7', '8'].map((rank, index) => ({
        id: `abrupt-dealer-${index}`,
        suit: index < 2 ? 'clubs' : 'spades',
        rank,
        copyIndex: index
      }));
      socketService.socket.listeners('bottom_revealed').forEach(listener => listener({
        bottomCards,
        bottomScoreResult: {
          attackerWonBottom: true,
          resultText: '闲家拿底',
          bottomPoints: 20,
          bottomMultiplier: 2,
          bottomScoreGained: 40,
          totalScore: 47.5,
          collectedPointCards: [],
          abruptStop: {
            dealerPlayerId: 'abrupt-dealer',
            dealerPlayerName: '庄家',
            dealerRemainingCards,
            dealerRemainingPoints: 15,
            attackerBonus: 7.5
          }
        },
        upgradeResult: {
          attackerWon: false,
          oldDealerLevel: 2,
          newDealerLevel: 3,
          dealerLevelUp: 1,
          oldAttackerLevel: 2,
          newAttackerLevel: 2,
          attackerLevelUp: 0,
          nextDealerName: '庄家',
          nextDealerLevel: 3
        }
      }));
    });

    const settlement = settlementPage.getByTestId('abrupt-stop-settlement');
    await expect(settlement).toBeVisible();
    await expect(settlement.locator('.card')).toHaveCount(4);
    await expect(settlement).toContainText('剩余牌面分 15');
    await expect(settlement).toContainText('闲家获得一半 +7.5 分');
    expect(await settlement.evaluate((element) => {
      const container = element.getBoundingClientRect();
      return [...element.querySelectorAll('.card')].every(card => {
        const bounds = card.getBoundingClientRect();
        return bounds.left >= container.left - 1 && bounds.right <= container.right + 1;
      });
    })).toBe(true);
    await settlementPage.locator('.settlement-panel').screenshot({
      path: testInfo.outputPath('abrupt-stop-final-hand.png')
    });
  } finally {
    await context.close();
  }
});

test('偷梁换柱把王转成方片 J 后移入 J 牌组，并在落桌后标明实体原牌', async ({ browser }, testInfo) => {
  test.setTimeout(120_000);
  const { context, pages } = await openTestModeGame(browser, '偷梁换柱');

  try {
    const firstPlayerIndex = await finishDealerBury(pages);
    const firstPlayerPage = pages[firstPlayerIndex];

    const [sourceCardId, queenCardId, jackCardId] = await firstPlayerPage.evaluate(async () => {
      const socketService = (await import('/src/services/socket.js')).default;
      const cards = [
        { id: 'stealing-sort-joker', suit: 'joker', rank: 'big_joker', copyIndex: 0 },
        { id: 'stealing-sort-queen', suit: 'diamonds', rank: 'Q', copyIndex: 0 },
        { id: 'stealing-sort-jack', suit: 'diamonds', rank: 'J', copyIndex: 0 }
      ];
      const listeners = socketService.socket.listeners('card_dealt');
      cards.forEach(card => listeners.forEach(listener => listener({ card })));
      return cards.map(card => card.id);
    });

    await firstPlayerPage.getByRole('button', { name: '偷梁换柱', exact: true }).click();
    await firstPlayerPage
      .locator(`.my-hand .card[data-card-id="${sourceCardId}"]`)
      .getByRole('button', { name: '转化此牌' })
      .dispatchEvent('click');

    const dialog = firstPlayerPage.getByRole('dialog', { name: '偷梁换柱 · 选择目标牌面' });
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: '♦ 方片' }).click();
    await expect(dialog.getByText(/第二步/)).toBeVisible();
    await dialog.getByRole('button', { name: 'J', exact: true }).click();

    const transformedCard = firstPlayerPage.locator('.my-hand .card:has(.joker-substitution-card-badge)');
    await expect(transformedCard).toHaveCount(1);
    await expect(transformedCard).not.toHaveClass(/selected/);
    await expect(transformedCard).toHaveAttribute('draggable', 'false');
    const previewOrder = await firstPlayerPage.locator('.my-hand .card').evaluateAll(
      elements => elements.map(element => ({
        id: element.dataset.cardId,
        rank: element.querySelector('.top-left .card-rank')?.textContent?.trim(),
        suit: element.querySelector('.top-left .card-suit')?.textContent?.trim()
      }))
    );
    const queenIndex = previewOrder.findIndex(card => card.id === queenCardId);
    const sourceIndex = previewOrder.findIndex(card => card.id === sourceCardId);
    const jackIndex = previewOrder.findIndex(card => card.id === jackCardId);
    expect(queenIndex).toBeLessThan(sourceIndex);
    expect(queenIndex).toBeLessThan(jackIndex);
    expect(previewOrder[sourceIndex]).toMatchObject({ rank: 'J', suit: '♦' });
    expect(previewOrder[jackIndex]).toMatchObject({ rank: 'J', suit: '♦' });
    const firstJackIndex = Math.min(sourceIndex, jackIndex);
    const lastJackIndex = Math.max(sourceIndex, jackIndex);
    expect(previewOrder.slice(firstJackIndex, lastJackIndex + 1).every(card => (
      card.rank === 'J' && card.suit === '♦'
    ))).toBe(true);
    const ordinaryCard = firstPlayerPage.locator(
      `.my-hand .card[data-card-id="${queenCardId}"]`
    );
    await ordinaryCard.dispatchEvent('click');
    const ordinaryPlayButton = firstPlayerPage.locator('.play-controls button').filter({
      hasText: /\(1\)$/
    }).first();
    await expect(ordinaryPlayButton).toBeEnabled();
    await ordinaryCard.dispatchEvent('click');
    await transformedCard.dispatchEvent('click');
    await expect(transformedCard).toHaveClass(/selected/);
    await transformedCard.getByRole('button', { name: '取消转化' }).dispatchEvent('click');
    await expect(firstPlayerPage.locator('.my-hand .joker-substitution-card-badge')).toHaveCount(0);
    await expect(firstPlayerPage.locator('.my-hand .card.selected')).toHaveCount(0);

    await firstPlayerPage.evaluate(async () => {
      const socketService = (await import('/src/services/socket.js')).default;
      const { useGameStore } = await import('/src/store/gameStore.js');
      const state = useGameStore.getState();
      const player = state.currentRoom.players[0];
      const transformedTableCard = {
        id: 'played-big-joker-as-diamond-j',
        suit: 'diamonds',
        rank: 'J',
        originalSuit: 'joker',
        originalRank: 'big_joker',
        isJokerSubstitution: true,
        copyIndex: 0
      };
      socketService.socket.listeners('cards_played').forEach(listener => listener({
        playerId: player.id,
        playerName: player.name,
        cards: [transformedTableCard],
        removedCardIds: [transformedTableCard.id],
        currentWinningPlayerId: player.id,
        jokerSubstitutions: [{
          cardId: transformedTableCard.id,
          suit: 'diamonds',
          rank: 'J'
        }]
      }));
    });

    const tableCard = firstPlayerPage.locator(
      '.played-cards-area .card[data-card-id="played-big-joker-as-diamond-j"]'
    );
    await expect(tableCard).toBeVisible();
    await expect(tableCard.locator('.original-face-badge')).toHaveText('原大王');
    await expect(tableCard.locator('.original-face-badge')).toHaveAttribute(
      'aria-label',
      '实体原牌：大王，当前牌面：♦J'
    );
    await expect(firstPlayerPage.locator('.joker-substitution-badge')).toContainText('大王→J♦');
    await firstPlayerPage.locator('.game-table').screenshot({
      path: testInfo.outputPath('transformed-card-original-face.png')
    });
  } finally {
    await context.close();
  }
});

test('跟牌提交后等待服务器确认期间不会重新选中剩余手牌', async ({ browser }) => {
  test.setTimeout(120_000);
  const { context, pages } = await openTestModeGame(browser, '记录在案');

  try {
    const fixturePageIndex = await finishDealerBury(pages);
    const followerPage = pages[fixturePageIndex];
    await followerPage.evaluate(async () => {
      const { useGameStore } = await import('/src/store/gameStore.js');
      const state = useGameStore.getState();
      const ownIndex = state.currentRoom.players.findIndex(
        player => player.id === state.currentPlayer.id
      );
      const leaderIndex = (ownIndex + state.currentRoom.players.length - 1)
        % state.currentRoom.players.length;
      const cards = [
        { id: 'pending-follow-club', suit: 'clubs', rank: 'A', copyIndex: 80 },
        { id: 'pending-follow-diamond-3', suit: 'diamonds', rank: '3', copyIndex: 81 },
        { id: 'pending-follow-diamond-4', suit: 'diamonds', rank: '4', copyIndex: 82 }
      ];
      useGameStore.setState({
        myCards: cards,
        selectedCards: [],
        trumpSuit: 'spades',
        trumpRank: '2',
        currentRoom: {
          ...state.currentRoom,
          players: state.currentRoom.players.map((player, index) => ({
            ...player,
            cardsCount: index === ownIndex ? cards.length : player.cardsCount
          })),
          gameState: {
            ...state.currentRoom.gameState,
            phase: 'playing',
            trumpSuit: 'spades',
            trumpRank: '2',
            currentPlayerIndex: ownIndex,
            currentRoundPlays: 1,
            playersPlayedThisRound: [leaderIndex],
            leadingPattern: {
              type: 'pair',
              suit: 'clubs',
              length: 2,
              cards: [
                { id: 'leader-club-k-0', suit: 'clubs', rank: 'K', copyIndex: 0 },
                { id: 'leader-club-k-1', suit: 'clubs', rank: 'K', copyIndex: 1 }
              ]
            }
          }
        }
      });
    });

    const selectedCards = followerPage.locator('.my-hand .card.selected');
    await expect(selectedCards).toHaveCount(1);
    await expect(selectedCards).toHaveAttribute('data-card-id', 'pending-follow-club');
    await followerPage
      .locator('.my-hand .card[data-card-id="pending-follow-diamond-3"]')
      .dispatchEvent('click');
    const playButton = followerPage.getByRole('button', { name: '出牌(2)' });
    await expect(playButton).toBeEnabled();

    // 模拟网络延迟：吞掉本次出牌请求，让旧快照继续显示仍由自己行动。
    // 清空选择若会重新触发自动跟牌，这里就会立刻再次抬起剩余同花色牌。
    await followerPage.evaluate(async () => {
      const socketService = (await import('/src/services/socket.js')).default;
      const socket = socketService.socket;
      const originalEmit = socket.emit.bind(socket);
      socket.emit = (event, ...args) => {
        if (event === 'play_cards') {
          window.__pendingPlayAcknowledgement = args.find(
            argument => typeof argument === 'function'
          );
          return socket;
        }
        return originalEmit(event, ...args);
      };
    });

    await playButton.click();
    await expect(selectedCards).toHaveCount(0);
    await followerPage.waitForTimeout(350);
    await expect(selectedCards).toHaveCount(0);

    // 拒绝回执会解除等待状态，仍轮到自己时可重新得到必要的跟牌提示。
    await followerPage.evaluate(() => {
      window.__pendingPlayAcknowledgement?.({ ok: false, message: '测试拒绝' });
    });
    await expect(selectedCards).toHaveCount(1);
    await expect(selectedCards).toHaveAttribute('data-card-id', 'pending-follow-club');
  } finally {
    await context.close();
  }
});

test('拆开两对出牌后提前到达的回合事件不会瞬间选中剩余对子', async ({ browser }) => {
  test.setTimeout(120_000);
  const { context, pages } = await openTestModeGame(browser, '记录在案');

  try {
    const fixturePageIndex = await finishDealerBury(pages);
    const followerPage = pages[fixturePageIndex];
    await followerPage.evaluate(async () => {
      const { useGameStore } = await import('/src/store/gameStore.js');
      const state = useGameStore.getState();
      const ownIndex = state.currentRoom.players.findIndex(
        player => player.id === state.currentPlayer.id
      );
      const leaderIndex = (ownIndex + state.currentRoom.players.length - 1)
        % state.currentRoom.players.length;
      const cards = [
        { id: 'split-pair-club-a-0', suit: 'clubs', rank: 'A', copyIndex: 80 },
        { id: 'split-pair-club-a-1', suit: 'clubs', rank: 'A', copyIndex: 81 },
        { id: 'split-pair-club-k-0', suit: 'clubs', rank: 'K', copyIndex: 82 },
        { id: 'split-pair-club-k-1', suit: 'clubs', rank: 'K', copyIndex: 83 },
        { id: 'split-pair-diamond-3', suit: 'diamonds', rank: '3', copyIndex: 84 }
      ];
      useGameStore.setState({
        myCards: cards,
        selectedCards: [],
        trumpSuit: 'spades',
        trumpRank: '2',
        currentRoom: {
          ...state.currentRoom,
          players: state.currentRoom.players.map((player, index) => ({
            ...player,
            cardsCount: index === ownIndex ? cards.length : player.cardsCount
          })),
          gameState: {
            ...state.currentRoom.gameState,
            phase: 'playing',
            trumpSuit: 'spades',
            trumpRank: '2',
            currentPlayerIndex: ownIndex,
            currentRoundPlays: 1,
            playersPlayedThisRound: [leaderIndex],
            leadingPattern: {
              type: 'pair',
              suit: 'clubs',
              length: 2,
              cards: [
                { id: 'leader-club-q-0', suit: 'clubs', rank: 'Q', copyIndex: 0 },
                { id: 'leader-club-q-1', suit: 'clubs', rank: 'Q', copyIndex: 1 }
              ]
            }
          }
        }
      });

      const socketService = (await import('/src/services/socket.js')).default;
      const socket = socketService.socket;
      const originalEmit = socket.emit.bind(socket);
      socket.emit = (event, ...args) => {
        if (event === 'play_cards') {
          window.__splitPairPlayAcknowledgement = args.find(
            argument => typeof argument === 'function'
          );
          return socket;
        }
        return originalEmit(event, ...args);
      };
    });

    const selectedCards = followerPage.locator('.my-hand .card.selected');
    await expect(selectedCards).toHaveCount(0);
    await followerPage
      .locator('.my-hand .card[data-card-id="split-pair-club-k-0"]')
      .dispatchEvent('click');
    await followerPage
      .locator('.my-hand .card[data-card-id="split-pair-club-k-1"]')
      .dispatchEvent('click');
    const playButton = followerPage.getByRole('button', { name: '出牌(2)' });
    await expect(playButton).toBeEnabled();
    await playButton.click();
    await expect(selectedCards).toHaveCount(0);

    // 服务端的实际顺序是回执、cards_played、round_updated、room_updated。
    // 前三个消息连续到达时，Zustand 会先同步删牌；剩余唯一对子仍不得被抬起。
    await followerPage.evaluate(async () => {
      const { useGameStore } = await import('/src/store/gameStore.js');
      const socketService = (await import('/src/services/socket.js')).default;
      const socket = socketService.socket;
      const state = useGameStore.getState();
      const ownIndex = state.currentRoom.players.findIndex(
        player => player.id === state.currentPlayer.id
      );
      const nextPlayerIndex = (ownIndex + 1) % state.currentRoom.players.length;
      const playedCards = state.myCards.filter(card => (
        card.id === 'split-pair-club-k-0' || card.id === 'split-pair-club-k-1'
      ));

      window.__splitPairPlayAcknowledgement?.({ ok: true, pending: false });
      socket.listeners('cards_played').forEach(listener => listener({
        playerId: state.currentPlayer.id,
        playerName: state.currentPlayer.name,
        cards: playedCards,
        removedCardIds: playedCards.map(card => card.id),
        cardsCount: playedCards.length,
        currentWinningPlayerId: state.currentPlayer.id
      }));
      socket.listeners('round_updated').forEach(listener => listener({
        type: 'turn_changed',
        currentPlayerIndex: nextPlayerIndex
      }));
    });

    await expect(followerPage.locator('.my-hand .card')).toHaveCount(3);
    await followerPage.waitForTimeout(350);
    await expect(selectedCards).toHaveCount(0);

    // 若自己赢得本墩，下一轮的 currentPlayerIndex 可能不变；仍要以 currentRound
    // 的权威快照解除保护，不能因此把玩家永久锁死。
    await followerPage.evaluate(async () => {
      const { useGameStore } = await import('/src/store/gameStore.js');
      const socketService = (await import('/src/services/socket.js')).default;
      const state = useGameStore.getState();
      const ownIndex = state.currentRoom.players.findIndex(
        player => player.id === state.currentPlayer.id
      );
      const room = {
        ...state.currentRoom,
        gameState: {
          ...state.currentRoom.gameState,
          currentRound: (state.currentRoom.gameState.currentRound || 1) + 1,
          currentPlayerIndex: ownIndex,
          currentRoundPlays: 0,
          playersPlayedThisRound: [],
          leadingPattern: null
        }
      };
      socketService.socket.listeners('room_updated').forEach(listener => listener({ room }));
    });
    const nextRoundCard = followerPage.locator(
      '.my-hand .card[data-card-id="split-pair-club-a-0"]'
    );
    await nextRoundCard.dispatchEvent('click');
    await expect(nextRoundCard).toHaveClass(/selected/);
  } finally {
    await context.close();
  }
});

test('冷却点数和花色会在所有玩家主视角中整轮灰显', async ({ browser }, testInfo) => {
  test.setTimeout(120_000);
  const { context, pages } = await openTestModeGame(browser, '冷却时间');

  try {
    await finishDealerBury(pages);

    const injectOwnRestriction = async (playerPage, { ruleId, ruleName, type, value }) => {
      await playerPage.evaluate(async (restriction) => {
        const { useGameStore } = await import('/src/store/gameStore.js');
        const socketService = (await import('/src/services/socket.js')).default;
        const state = useGameStore.getState();
        const playerId = state.currentPlayer.id;
        const room = {
          ...state.currentRoom,
          gameState: {
            ...state.currentRoom.gameState,
            currentRound: 2,
            selectedRule: {
              id: restriction.ruleId,
              name: restriction.ruleName,
              content: '测试冷却牌灰显'
            },
            cardCooldown: {
              type: restriction.type,
              valuesByPlayerId: { [playerId]: [restriction.value] }
            }
          }
        };
        socketService.socket.listeners('room_updated').forEach(listener => listener({ room }));
      }, { ruleId, ruleName, type, value });
    };

    for (const playerPage of pages) {
      const rank = await playerPage
        .locator('.my-hand .card:not(.joker-card) .top-left .card-rank')
        .first()
        .textContent();
      await injectOwnRestriction(playerPage, {
        ruleId: 'cooldown_time',
        ruleName: '冷却时间',
        type: 'rank',
        value: rank
      });
      await expect.poll(() => playerPage.locator('.my-hand .card.rule-disabled').count()).toBeGreaterThan(0);
      const titles = await playerPage.locator('.my-hand .card.rule-disabled').evaluateAll(cards => (
        cards.map(card => card.getAttribute('title'))
      ));
      expect(titles.every(title => title?.includes('该点数在本轮冷却中'))).toBe(true);
    }
    await pages[0].locator('.my-hand').screenshot({
      path: testInfo.outputPath('rank-cooldown-disabled-cards.png')
    });

    const suitSymbols = { '♥': 'hearts', '♦': 'diamonds', '♣': 'clubs', '♠': 'spades' };
    for (const playerPage of pages) {
      const suitSymbol = await playerPage
        .locator('.my-hand .card:not(.joker-card) .top-left .card-suit')
        .first()
        .textContent();
      await injectOwnRestriction(playerPage, {
        ruleId: 'time_cooling',
        ruleName: '时间冷却',
        type: 'suit',
        value: suitSymbols[suitSymbol]
      });
      await expect.poll(() => playerPage.locator('.my-hand .card.rule-disabled').count()).toBeGreaterThan(0);
      const titles = await playerPage.locator('.my-hand .card.rule-disabled').evaluateAll(cards => (
        cards.map(card => card.getAttribute('title'))
      ));
      expect(titles.every(title => title?.includes('该花色在本轮冷却中'))).toBe(true);
    }
    await pages[0].locator('.my-hand').screenshot({
      path: testInfo.outputPath('suit-cooldown-disabled-cards.png')
    });

    let pagesWithTrumpCards = 0;
    for (const playerPage of pages) {
      const trumpCards = playerPage.locator('.my-hand .card:has(.trump-badge)');
      if (await trumpCards.count() === 0) continue;
      pagesWithTrumpCards += 1;
      await injectOwnRestriction(playerPage, {
        ruleId: 'time_cooling',
        ruleName: '时间冷却',
        type: 'suit',
        value: 'trump'
      });
      await expect(trumpCards.first()).toHaveClass(/rule-disabled/);
      await expect(playerPage.locator('.my-hand .card:has(.trump-badge):not(.rule-disabled)')).toHaveCount(0);
    }
    expect(pagesWithTrumpCards).toBeGreaterThan(0);
    await pages[0].locator('.my-hand').screenshot({
      path: testInfo.outputPath('trump-cooldown-disabled-cards.png')
    });
  } finally {
    await context.close();
  }
});

test('无独有偶规则框随当前轮次标记零分或双倍，轮末清桌前保持本轮性质', async ({ browser }) => {
  test.setTimeout(120_000);
  const { context, pages } = await openTestModeGame(browser, '无独有偶');

  try {
    await finishDealerBury(pages);
    for (const playerPage of pages) {
      const status = playerPage.getByTestId('odd-even-round-status');
      await expect(status).toHaveAttribute('data-round', '1');
      await expect(status).toHaveAttribute('data-parity', 'odd');
      await expect(status).toContainText('奇数轮');
      await expect(status).toContainText('本轮0分');
    }

    const heldRoundSnapshot = await pages[0].evaluate(async () => {
      const { useGameStore } = await import('/src/store/gameStore.js');
      const socketService = (await import('/src/services/socket.js')).default;
      const state = useGameStore.getState();
      const player = state.currentRoom.players[0];
      socketService.socket.listeners('cards_played').forEach(listener => listener({
        playerId: player.id,
        playerName: player.name,
        cards: [{ id: 'odd-round-ten', suit: 'hearts', rank: '10' }],
        cardsCount: 1,
        remainingCount: 24
      }));
      socketService.socket.listeners('round_updated').forEach(listener => listener({
        type: 'round_ended',
        round: 1,
        roundWinner: {
          playerIndex: 0,
          playerId: player.id,
          playerName: player.name
        },
        scoreInfo: { hidden: true }
      }));
      const room = {
        ...state.currentRoom,
        gameState: {
          ...state.currentRoom.gameState,
          currentRound: 2
        }
      };
      socketService.socket.listeners('room_updated').forEach(listener => listener({ room }));
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      const status = document.querySelector('[data-testid="odd-even-round-status"]');
      return {
        round: status?.getAttribute('data-round'),
        parity: status?.getAttribute('data-parity'),
        pointsIndicatorCount: document.querySelectorAll('.round-points-indicator').length
      };
    });

    expect(heldRoundSnapshot).toEqual({
      round: '1',
      parity: 'odd',
      pointsIndicatorCount: 0
    });

    const status = pages[0].getByTestId('odd-even-round-status');
    await expect(status).toHaveAttribute('data-round', '2', { timeout: 3_000 });
    await expect(status).toHaveAttribute('data-parity', 'even');
    await expect(status).toContainText('偶数轮');
    await expect(status).toContainText('本轮双倍');
  } finally {
    await context.close();
  }
});

test('烛尽天明在轮末事件分帧到达时也只在清桌后切换烛态', async ({ browser }) => {
  test.setTimeout(120_000);
  const { context, pages } = await openTestModeGame(browser, '记录在案');

  try {
    await finishDealerBury(pages);
    const playerPage = pages[0];
    await playerPage.evaluate(async () => {
      const { useGameStore } = await import('/src/store/gameStore.js');
      const state = useGameStore.getState();
      useGameStore.setState({
        currentRoom: {
          ...state.currentRoom,
          gameState: {
            ...state.currentRoom.gameState,
            phase: 'playing',
            currentRound: 1,
            selectedRule: {
              id: 'candle_to_dawn',
              name: '烛尽天明',
              content: '轮末按第四手颜色决定下一轮烛态。'
            },
            candleToDawn: {
              selectorPlayerId: null,
              isSelectionPending: false,
              isLit: true,
              lastTransition: null
            }
          }
        }
      });
    });

    const status = playerPage.getByTestId('candle-to-dawn-status');
    await expect(status).toHaveAttribute('data-round', '1');
    await expect(status).toHaveAttribute('data-candle-state', 'lit');

    const statesBeforeRoundEvent = await playerPage.evaluate(async () => {
      const { useGameStore } = await import('/src/store/gameStore.js');
      const socketService = (await import('/src/services/socket.js')).default;
      const socket = socketService.socket;
      const state = useGameStore.getState();
      const statusElement = document.querySelector('[data-testid="candle-to-dawn-status"]');
      window.__candleStateChanges = [];
      const recordState = () => {
        window.__candleStateChanges.push({
          round: statusElement?.getAttribute('data-round'),
          state: statusElement?.getAttribute('data-candle-state')
        });
      };
      recordState();
      const observer = new MutationObserver(recordState);
      observer.observe(statusElement, {
        attributes: true,
        attributeFilter: ['data-round', 'data-candle-state']
      });
      window.__candleStateObserver = observer;

      const cardsPlayedListeners = socket.listeners('cards_played');
      state.currentRoom.players.forEach((player, index) => {
        cardsPlayedListeners.forEach(listener => listener({
          playerId: player.id,
          playerName: player.name,
          cards: [{
            id: `candle-hold-${index}`,
            suit: index === 3 ? 'clubs' : 'hearts',
            rank: '5',
            copyIndex: 70 + index
          }],
          cardsCount: 1,
          remainingCount: 24,
          currentWinningPlayerId: player.id
        }));
      });

      // 故意让“已切到下一轮、但尚未附带 transition”的房间快照先到一帧。
      // 第四手到达时冻结的权威旧烛态必须挡住这次提前更新。
      const nextRoomWithoutTransition = {
        ...state.currentRoom,
        gameState: {
          ...state.currentRoom.gameState,
          phase: 'playing',
          currentRound: 2,
          selectedRule: {
            id: 'candle_to_dawn',
            name: '烛尽天明',
            content: '轮末按第四手颜色决定下一轮烛态。'
          },
          candleToDawn: {
            selectorPlayerId: null,
            isSelectionPending: false,
            isLit: false,
            lastTransition: null
          }
        }
      };
      socket.listeners('room_updated').forEach(listener => listener({
        room: nextRoomWithoutTransition
      }));
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      return [...window.__candleStateChanges];
    });
    expect(statesBeforeRoundEvent.every(change => (
      change.round === '1' && change.state === 'lit'
    ))).toBe(true);

    await playerPage.evaluate(async () => {
      const { useGameStore } = await import('/src/store/gameStore.js');
      const socketService = (await import('/src/services/socket.js')).default;
      const socket = socketService.socket;
      const transition = {
        round: 1,
        previousLit: true,
        nextLit: false,
        changed: true,
        triggerColor: 'black'
      };
      socket.listeners('round_updated').forEach(listener => listener({
        type: 'round_ended',
        round: 1,
        candleTransition: transition
      }));
      const state = useGameStore.getState();
      socket.listeners('room_updated').forEach(listener => listener({
        room: {
          ...state.currentRoom,
          gameState: {
            ...state.currentRoom.gameState,
            currentRound: 2,
            candleToDawn: {
              ...state.currentRoom.gameState.candleToDawn,
              isLit: false,
              lastTransition: transition
            }
          }
        }
      }));
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    });
    await expect(status).toHaveAttribute('data-round', '1');
    await expect(status).toHaveAttribute('data-candle-state', 'lit');

    await expect(status).toHaveAttribute('data-round', '2', { timeout: 3_000 });
    await expect(status).toHaveAttribute('data-candle-state', 'unlit');
    const allObservedStates = await playerPage.evaluate(() => {
      window.__candleStateObserver?.disconnect();
      return window.__candleStateChanges;
    });
    expect(allObservedStates.findIndex(change => change.state === 'unlit')).toBe(
      allObservedStates.length - 1
    );
  } finally {
    await context.close();
  }
});

test('第二战场在出牌开始前向四个视角同时亮出五张公共牌', async ({ browser }, testInfo) => {
  test.setTimeout(120_000);
  const { context, pages } = await openTestModeGame(browser, '第二战场');

  try {
    await finishDealerBury(pages);
    for (const playerPage of pages) {
      const tray = playerPage.getByTestId('second-battlefield-tray');
      await expect(tray).toBeVisible();
      await expect(tray).toHaveAttribute('data-generation', '1');
      await expect(tray.locator('.second-battlefield-card-row .card')).toHaveCount(5);
      await expect(tray).toContainText('第1场');
      await expect(tray).toContainText('五张公共牌已全部亮出');
      await expect(tray.locator('.second-battlefield-progress')).toHaveCount(0);

      await playerPage.evaluate(async () => {
        const { useGameStore } = await import('/src/store/gameStore.js');
        const socketService = (await import('/src/services/socket.js')).default;
        const state = useGameStore.getState();
        const accumulatedCardsByPlayerId = Object.fromEntries(
          state.currentRoom.players.map((player, playerIndex) => [
            player.id,
            Array.from({ length: 5 }, (_, cardIndex) => ({
              id: `staged-${player.id}-${cardIndex}`,
              suit: ['hearts', 'diamonds', 'clubs', 'spades'][playerIndex],
              rank: String(cardIndex + 2)
            }))
          ])
        );
        const room = {
          ...state.currentRoom,
          gameState: {
            ...state.currentRoom.gameState,
            secondBattlefield: {
              ...state.currentRoom.gameState.secondBattlefield,
              accumulatedCardsByPlayerId
            }
          }
        };
        socketService.socket.listeners('room_updated').forEach(listener => listener({ room }));
        const scoringPlayer = state.currentRoom.players[0];
        socketService.socket.listeners('cards_played').forEach(listener => listener({
          playerId: scoringPlayer.id,
          playerName: scoringPlayer.name,
          cards: [{ id: `round-point-${scoringPlayer.id}`, suit: 'hearts', rank: '10' }],
          cardsCount: 1,
          remainingCount: scoringPlayer.cardsCount - 1
        }));
      });
      await expect(playerPage.locator('.second-battlefield-staged-cards')).toHaveCount(4);
      await expect(playerPage.locator('.second-battlefield-staged-card-row .card')).toHaveCount(20);
      await expect(playerPage.locator('.second-battlefield-staged-card-row .card.small')).toHaveCount(20);
      await expect(playerPage.locator('.second-battlefield-staged-cards[data-position="top"]')).toHaveCount(1);
      await expect(playerPage.locator('.second-battlefield-staged-cards[data-position="bottom"]')).toHaveCount(1);
      await expect(playerPage.locator('.second-battlefield-side-player .second-battlefield-staged-cards')).toHaveCount(2);
      await expect(playerPage.locator('.second-battlefield-round-points')).toHaveCount(1);
      await expect(playerPage.locator('.round-points-indicator')).toHaveCount(0);

      const overlappingAreas = await playerPage.evaluate(() => {
        const rect = selector => {
          const element = document.querySelector(selector);
          if (!element) return null;
          const bounds = element.getBoundingClientRect();
          return {
            left: bounds.left,
            right: bounds.right,
            top: bounds.top,
            bottom: bounds.bottom
          };
        };
        const overlaps = (first, second) => Boolean(
          first && second
          && first.left < second.right
          && first.right > second.left
          && first.top < second.bottom
          && first.bottom > second.top
        );
        const publicTray = rect('.second-battlefield-tray');
        const publicCards = rect('.second-battlefield-card-row');
        const roundPoints = rect('.second-battlefield-round-points');
        const positions = ['top', 'right', 'bottom', 'left'];
        const blockedPositions = positions.filter(position => {
          const staged = rect(`.second-battlefield-staged-${position}`);
          const currentPlay = rect(`.played-cards-${position}`);
          return overlaps(staged, publicTray) || overlaps(staged, currentPlay);
        });
        const stagedPairs = [];
        positions.forEach((position, index) => {
          positions.slice(index + 1).forEach(otherPosition => {
            if (overlaps(
              rect(`.second-battlefield-staged-${position}`),
              rect(`.second-battlefield-staged-${otherPosition}`)
            )) {
              stagedPairs.push(`${position}-${otherPosition}`);
            }
          });
        });
        return {
          blockedPositions,
          stagedPairs,
          publicCardsOverlapRoundPoints: overlaps(publicCards, roundPoints)
        };
      });
      expect(overlappingAreas).toEqual({
        blockedPositions: [],
        stagedPairs: [],
        publicCardsOverlapRoundPoints: false
      });
    }
    await pages[0].screenshot({ path: testInfo.outputPath('second-battlefield-staged-layout.png') });
  } finally {
    await context.close();
  }
});

test('君子一言只询问并列最短花色，完成后四视角公开声明', async ({ browser }, testInfo) => {
  test.setTimeout(150_000);
  const { context, pages } = await openTestModeGame(browser, '君子一言');

  try {
    await Promise.all(pages.map(page => page.setViewportSize({ width: 1440, height: 900 })));
    await finishDealerBury(pages);

    for (const playerPage of pages) {
      const isPending = await playerPage.evaluate(async () => {
        const { useGameStore } = await import('/src/store/gameStore.js');
        const state = useGameStore.getState();
        return state.currentRoom.gameState.gentlemanPromise?.pendingPlayerIds
          ?.includes(state.currentPlayer.id) || false;
      });
      const dialog = playerPage.getByRole('dialog', { name: '君子一言 · 声明最短花色' });
      if (!isPending) {
        await expect(dialog).toHaveCount(0);
        continue;
      }
      await expect(dialog).toBeVisible();
      const options = dialog.locator('.gentleman-promise-suit-grid .ant-btn');
      expect(await options.count()).toBeGreaterThan(1);
      await options.first().click();
      await dialog.getByRole('button', { name: /^声明 / }).click();
    }

    await Promise.all(pages.map(async playerPage => {
      await expect(playerPage.getByRole('dialog', { name: '君子一言 · 声明最短花色' })).toHaveCount(0);
      const status = playerPage.getByTestId('gentleman-promise-status');
      await expect(status).toBeVisible();
      await expect(status.locator('.gentleman-promise-status-grid > div')).toHaveCount(4);
      await expect(status.locator('.gentleman-promise-status-grid .is-pending')).toHaveCount(0);
    }));
    await pages[0].getByTestId('gentleman-promise-status').screenshot({
      path: testInfo.outputPath('gentleman-promise-declarations.png')
    });
  } finally {
    await context.close();
  }
});

test('焦点人物只在队内循环表决，牌中隐藏总分并在终局展示逐人明细', async ({ browser }, testInfo) => {
  test.setTimeout(150_000);
  const { context, pages } = await openTestModeGame(browser, '焦点人物');

  try {
    await Promise.all(pages.map(page => page.setViewportSize({ width: 1440, height: 900 })));
    await finishDealerBury(pages);

    const dialogs = pages.map(page => page.getByRole('dialog', { name: /焦点人物 · 队伍\d表决/ }));
    await Promise.all(dialogs.map(dialog => expect(dialog).toBeVisible()));
    const teamNumbers = await Promise.all(dialogs.map(async dialog => {
      const title = await dialog.locator('.ant-modal-title').textContent();
      return Number(title.match(/队伍(\d)/)?.[1]);
    }));
    const teamOneIndexes = teamNumbers.map((team, index) => team === 1 ? index : -1).filter(index => index >= 0);
    const teamTwoIndexes = teamNumbers.map((team, index) => team === 2 ? index : -1).filter(index => index >= 0);
    expect(teamOneIndexes).toHaveLength(2);
    expect(teamTwoIndexes).toHaveLength(2);
    const [teamOneFirst, teamOneSecond] = teamOneIndexes;
    const [teamTwoFirst, teamTwoSecond] = teamTwoIndexes;
    const teamOneInitial = await dialogs[teamOneFirst].locator('.player-decision-primary-text strong').textContent();
    const teamOnePartnerView = await dialogs[teamOneSecond].locator('.player-decision-primary-text strong').textContent();
    const teamTwoInitial = await dialogs[teamTwoFirst].locator('.player-decision-primary-text strong').textContent();
    const teamTwoPartnerView = await dialogs[teamTwoSecond].locator('.player-decision-primary-text strong').textContent();
    expect(teamOnePartnerView).toBe(teamOneInitial);
    expect(teamTwoPartnerView).toBe(teamTwoInitial);

    await pages[teamOneFirst].locator('.focus-figure-vote-modal-wrap .ant-modal-footer .ant-btn-default').click({ force: true });
    let remainingTeamOneIndex = -1;
    await expect.poll(async () => {
      for (let index = 0; index < pages.length; index += 1) {
        if (index === teamOneFirst) continue;
        const dialog = dialogs[index];
        if (!await dialog.isVisible().catch(() => false)) continue;
        if ((await dialog.locator('.ant-modal-title').textContent()).includes('队伍1')) {
          remainingTeamOneIndex = index;
          return index;
        }
      }
      return -1;
    }).toBeGreaterThanOrEqual(0);
    await pages[remainingTeamOneIndex].locator('.focus-figure-vote-modal-wrap .ant-modal-footer .ant-btn-primary').click({ force: true });
    await Promise.all(teamOneIndexes.map(index => expect(dialogs[index]).toBeVisible()));
    const teamOneSwitched = await dialogs[teamOneFirst].locator('.player-decision-primary-text strong').textContent();
    expect(teamOneSwitched).not.toBe(teamOneInitial);
    await expect(dialogs[teamOneSecond].locator('.player-decision-primary-text strong')).toHaveText(teamOneSwitched);

    await Promise.all([
      pages[teamTwoFirst].locator('.focus-figure-vote-modal-wrap .ant-modal-footer .ant-btn-primary').click({ force: true }),
      pages[teamTwoSecond].locator('.focus-figure-vote-modal-wrap .ant-modal-footer .ant-btn-primary').click({ force: true })
    ]);
    await Promise.all([
      pages[teamOneFirst].locator('.focus-figure-vote-modal-wrap .ant-modal-footer .ant-btn-primary').click({ force: true }),
      pages[teamOneSecond].locator('.focus-figure-vote-modal-wrap .ant-modal-footer .ant-btn-primary').click({ force: true })
    ]);

    await Promise.all(pages.map(async playerPage => {
      await expect(playerPage.getByRole('dialog', { name: /焦点人物 · 队伍\d表决/ })).toHaveCount(0);
      await expect(playerPage.locator('.score-panel')).toContainText('实际得分终局揭晓');
      await expect(playerPage.locator('.score-panel')).not.toContainText(/闲家得分\s*\d+\s*分/);
      await expect(playerPage.locator('.focus-figure-player-badge')).toHaveCount(1);
      await expect(playerPage.locator('.focus-figure-captured-points')).toHaveCount(4);
      await expect(playerPage.locator('.focus-figure-captured-points')).toHaveText([
        '被闲家收走 0 分',
        '被闲家收走 0 分',
        '被闲家收走 0 分',
        '被闲家收走 0 分'
      ]);
      const publicFocus = await playerPage.evaluate(async () => {
        const { useGameStore } = await import('/src/store/gameStore.js');
        return useGameStore.getState().currentRoom.gameState.focusFigure;
      });
      expect(publicFocus.isVotingPending).toBe(false);
      expect(publicFocus.isRevealed).toBe(false);
      expect(publicFocus.teams).toBeUndefined();
      expect(Object.values(publicFocus.capturedPointsByPlayerId)).toEqual([0, 0, 0, 0]);
    }));
    await pages[0].evaluate(async () => {
      const { useGameStore } = await import('/src/store/gameStore.js');
      const state = useGameStore.getState();
      const capturedPointsByPlayerId = Object.fromEntries(
        state.currentRoom.players.map((player, index) => [player.id, [5, 10, 15, 20][index]])
      );
      useGameStore.setState({
        currentRoom: {
          ...state.currentRoom,
          gameState: {
            ...state.currentRoom.gameState,
            focusFigure: {
              ...state.currentRoom.gameState.focusFigure,
              capturedPointsByPlayerId
            }
          }
        }
      });
    });
    await expect(pages[0].locator('.focus-figure-captured-points')).toHaveText([
      /被闲家收走 (5|10|15|20) 分/,
      /被闲家收走 (5|10|15|20) 分/,
      /被闲家收走 (5|10|15|20) 分/,
      /被闲家收走 (5|10|15|20) 分/
    ]);
    expect(
      (await pages[0].locator('.focus-figure-captured-points').allTextContents())
        .map(text => Number(text.match(/\d+/)?.[0]))
        .sort((a, b) => a - b)
    ).toEqual([5, 10, 15, 20]);
    await pages[0].locator('.game-table').screenshot({
      path: testInfo.outputPath('focus-figure-private-marker-and-captured-points.png')
    });
    await pages[0].locator('.score-panel').screenshot({
      path: testInfo.outputPath('focus-figure-hidden-score.png')
    });

    await pages[0].evaluate(async () => {
      const { useGameStore } = await import('/src/store/gameStore.js');
      const socketService = (await import('/src/services/socket.js')).default;
      const state = useGameStore.getState();
      const players = state.currentRoom.players;
      useGameStore.setState({
        currentRoom: {
          ...state.currentRoom,
          gameState: { ...state.currentRoom.gameState, phase: 'revealing', attackerScore: 50 }
        }
      });
      const bottomCards = ['5', '2', '3', '4', '6', '7', '8', '9'].map((rank, index) => ({
        id: `focus-bottom-${index}`,
        suit: index % 2 === 0 ? 'diamonds' : 'clubs',
        rank,
        copyIndex: index
      }));
      socketService.socket.listeners('bottom_revealed').forEach(listener => listener({
        bottomCards,
        bottomScoreResult: {
          attackerWonBottom: true,
          resultText: '闲家拿底',
          bottomPoints: 5,
          bottomMultiplier: 2,
          bottomScoreGained: 10,
          baseScore: 40,
          totalScore: 50,
          collectedPointCards: [],
          focusFigure: {
            teams: [
              { team: 1, side: 'dealer', focusPlayerId: players[2].id, focusPlayerName: players[2].name },
              { team: 2, side: 'attacker', focusPlayerId: players[1].id, focusPlayerName: players[1].name }
            ],
            players: players.map((player, index) => ({
              playerId: player.id,
              playerName: player.name,
              isFocus: index === 1 || index === 2,
              capturedPoints: [5, 10, 10, 15][index],
              countedPoints: index === 1 || index === 2 ? [5, 10, 10, 15][index] * 2 : 0
            })),
            focusTrickScore: 40,
            normalBottomScore: 10,
            totalScore: 50
          }
        },
        upgradeResult: {
          attackerWon: false,
          oldDealerLevel: 2,
          newDealerLevel: 3,
          dealerLevelUp: 1,
          oldAttackerLevel: 2,
          newAttackerLevel: 2,
          attackerLevelUp: 0,
          nextDealerName: players[0].name,
          nextDealerLevel: 3
        }
      }));
    });

    const settlement = pages[0].getByTestId('focus-figure-settlement');
    await expect(settlement).toBeVisible();
    await expect(settlement).toContainText('焦点人物 · 终局揭晓');
    await expect(settlement).toContainText('焦点逐墩 40 分');
    await expect(settlement).toContainText('正常底牌 10 分');
    await expect(pages[0].locator('.settlement-bottom-result')).toContainText('闲家总分：50 分');
    await pages[0].locator('.settlement-panel').screenshot({
      path: testInfo.outputPath('focus-figure-settlement.png')
    });
  } finally {
    await context.close();
  }
});

test('再衰三竭在规则框显示连续轮数与下一次罚分', async ({ browser }, testInfo) => {
  test.setTimeout(120_000);
  const { context, pages } = await openTestModeGame(browser, '再衰三竭');

  try {
    await finishDealerBury(pages);
    await Promise.all(pages.map(playerPage => playerPage.evaluate(async () => {
      const { useGameStore } = await import('/src/store/gameStore.js');
      const socketService = (await import('/src/services/socket.js')).default;
      const state = useGameStore.getState();
      const leader = state.currentRoom.players[0];
      const room = {
        ...state.currentRoom,
        gameState: {
          ...state.currentRoom.gameState,
          repeatedExhaustion: {
            playerId: leader.id,
            streak: 3,
            lastPenalty: 5,
            lastScoreDelta: 5
          }
        }
      };
      socketService.socket.listeners('room_updated').forEach(listener => listener({ room }));
    })));

    await Promise.all(pages.map(async playerPage => {
      const status = playerPage.getByTestId('repeated-exhaustion-status');
      await expect(status).toBeVisible();
      await expect(status).toContainText('连续 3 轮');
      await expect(status).toContainText('再赢扣10分');
    }));
    await pages[0].getByTestId('repeated-exhaustion-status').screenshot({
      path: testInfo.outputPath('repeated-exhaustion-status.png')
    });
  } finally {
    await context.close();
  }
});

test('暗牌轮末揭示、整手交换和绝处逢生提示具有完整牌桌反馈', async ({ browser }, testInfo) => {
  test.setTimeout(120_000);
  const { context, pages } = await openTestModeGame(browser, '暗度陈仓');
  const page = pages[0];

  try {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    // 等庄家埋底完成后再注入牌局事件，避免发牌阶段最后一次房间快照清空测试牌面。
    await finishDealerBury(pages);
    await page.evaluate(async () => {
      const { useGameStore } = await import('/src/store/gameStore.js');
      const socketService = (await import('/src/services/socket.js')).default;
      const players = useGameStore.getState().currentRoom.players;
      const hiddenPlayer = players[1];

      socketService.socket.listeners('cards_played').forEach(listener => listener({
        playerId: hiddenPlayer.id,
        playerName: hiddenPlayer.name,
        cards: [],
        cardsCount: 3,
        concealed: true,
        activeSkillId: 'concealed_passage',
        activeSkillName: '暗度陈仓',
        currentWinningPlayerId: null
      }));
    });

    const concealedStack = page.locator('.concealed-play-stack');
    await expect(concealedStack).toBeVisible();
    await expect(concealedStack.locator('.concealed-play-card')).toHaveCount(3);
    await expect(concealedStack.locator('.concealed-play-label')).toHaveText('暗置 · 3');
    await page.locator('.game-table').screenshot({
      path: testInfo.outputPath('concealed-passage-card-backs.png')
    });

    await page.evaluate(async () => {
      const { useGameStore } = await import('/src/store/gameStore.js');
      const socketService = (await import('/src/services/socket.js')).default;
      const hiddenPlayer = useGameStore.getState().currentRoom.players[1];
      socketService.socket.listeners('concealed_plays_revealed').forEach(listener => listener({
        plays: [{
          playerId: hiddenPlayer.id,
          concealed: true,
          cards: [
            { id: 'revealed-spade-7', suit: 'hearts', originalSuit: 'spades', rank: '7', copyIndex: 0 },
            { id: 'revealed-heart-7', suit: 'hearts', rank: '7', copyIndex: 0 },
            { id: 'revealed-heart-8', suit: 'hearts', rank: '8', copyIndex: 0 }
          ]
        }]
      }));
    });

    await expect(concealedStack).toHaveCount(0);
    await expect(page.locator('.concealed-just-revealed .card')).toHaveCount(3);
    await expect(page.locator('.concealed-just-revealed .converted-spade-badge')).toHaveText('♠→♥');

    await page.evaluate(async () => {
      const { useGameStore } = await import('/src/store/gameStore.js');
      const socketService = (await import('/src/services/socket.js')).default;
      const players = useGameStore.getState().currentRoom.players;
      const transfers = players.map((player, index) => ({
        fromPlayerId: player.id,
        fromPlayerName: player.name,
        toPlayerId: players[(index + 2) % players.length].id,
        toPlayerName: players[(index + 2) % players.length].name,
        cardsCount: 12
      }));
      socketService.socket.listeners('whole_hand_exchange_resolved').forEach(listener => listener({
        ruleName: '斗转星移',
        transfers,
        animationDuration: 1600
      }));
    });

    const exchangeLayer = page.locator('.card-exchange-animation-layer');
    await expect(exchangeLayer).toBeVisible();
    await expect(exchangeLayer.locator('.exchange-flying-card')).toHaveCount(28);
    await expect(exchangeLayer.locator('.card-exchange-animation-title')).toHaveText('斗转星移');
    await expect(page.getByRole('button', { name: /斗转星移 · 整手交换中/ })).toBeDisabled();
    await expect(page.locator('.my-hand .card').first()).toHaveClass(/disabled/);
    await page.screenshot({
      path: testInfo.outputPath('whole-hand-exchange-animation.png'),
      animations: 'allow'
    });

    await expect(exchangeLayer).toBeHidden({ timeout: 5_000 });
    await page.evaluate(async () => {
      const { useGameStore } = await import('/src/store/gameStore.js');
      const socketService = (await import('/src/services/socket.js')).default;
      const room = useGameStore.getState().currentRoom;
      const players = room.players;
      const targetByPlayerId = Object.fromEntries(players.map((player, index) => [
        player.id,
        players[(index + 1) % players.length].id
      ]));
      socketService.socket.listeners('room_updated').forEach(listener => listener({
        room: {
          ...room,
          gameState: {
            ...room.gameState,
            cardExchange: {
              stage: 'round',
              triggerRound: 1,
              ruleId: 'frequent_fluctuation',
              ruleName: '频繁波动',
              requiredCards: 1,
              targetByPlayerId,
              submittedPlayerIds: []
            }
          }
        }
      }));
    });

    const roundExchangeButton = page.getByRole('button', { name: '确认交牌(0/1)' });
    await expect(roundExchangeButton).toBeVisible();
    await expect(page.locator('.card-exchange-status')).toContainText('请选择 1 张牌交给');
    await page.locator('.my-hand .card').first().dispatchEvent('click');
    await expect(page.getByRole('button', { name: '确认交牌(1/1)' })).toBeEnabled();
    await page.evaluate(async () => {
      const { useGameStore } = await import('/src/store/gameStore.js');
      const socketService = (await import('/src/services/socket.js')).default;
      const players = useGameStore.getState().currentRoom.players;
      const transfers = players.map((player, index) => ({
        fromPlayerId: player.id,
        fromPlayerName: player.name,
        toPlayerId: players[(index + 1) % players.length].id,
        toPlayerName: players[(index + 1) % players.length].name,
        cardsCount: 1
      }));
      socketService.socket.listeners('card_exchange_resolved').forEach(listener => listener({
        ruleName: '频繁波动',
        transfers,
        animationDuration: 1600
      }));
    });
    await expect(exchangeLayer).toBeVisible();
    await expect(exchangeLayer.locator('.exchange-flying-card')).toHaveCount(4);
    await expect(page.getByRole('button', { name: /频繁波动 · 交换中/ })).toBeDisabled();
    await page.screenshot({
      path: testInfo.outputPath('round-single-card-exchange-animation.png'),
      animations: 'allow'
    });

    await expect(exchangeLayer).toBeHidden({ timeout: 5_000 });
    await page.evaluate(async () => {
      const { useGameStore } = await import('/src/store/gameStore.js');
      const socketService = (await import('/src/services/socket.js')).default;
      const room = useGameStore.getState().currentRoom;
      const players = room.players;
      const targetByPlayerId = Object.fromEntries(players.map(player => [player.id, null]));
      const exchange = {
        stage: 'round',
        operation: 'discard',
        triggerRound: 2,
        ruleId: 'lingering_discard',
        ruleName: '弃掷逦迤',
        requiredCards: 1,
        targetByPlayerId,
        submittedPlayerIds: []
      };
      socketService.socket.listeners('room_updated').forEach(listener => listener({
        room: { ...room, gameState: { ...room.gameState, cardExchange: exchange } }
      }));
      socketService.socket.listeners('card_exchange_started').forEach(listener => listener({
        ...exchange,
        transfers: players.map(player => ({
          fromPlayerId: player.id,
          fromPlayerName: player.name,
          toPlayerId: null,
          toPlayerName: '弃牌区',
          cardsCount: 1
        }))
      }));
    });

    await expect(page.locator('.card-exchange-status')).toContainText('请选择 1 张牌暗中弃置');
    await expect(page.getByRole('button', { name: '确认弃牌(0/1)' })).toBeVisible();
    await page.locator('.my-hand .card').first().dispatchEvent('click');
    await expect(page.getByRole('button', { name: '确认弃牌(1/1)' })).toBeEnabled();
    await page.evaluate(async () => {
      const { useGameStore } = await import('/src/store/gameStore.js');
      const socketService = (await import('/src/services/socket.js')).default;
      const players = useGameStore.getState().currentRoom.players;
      socketService.socket.listeners('card_exchange_resolved').forEach(listener => listener({
        ruleName: '弃掷逦迤',
        operation: 'discard',
        transfers: players.map(player => ({
          fromPlayerId: player.id,
          fromPlayerName: player.name,
          toPlayerId: null,
          toPlayerName: '弃牌区',
          cardsCount: 1
        })),
        animationDuration: 1600
      }));
    });
    await expect(exchangeLayer).toBeVisible();
    await expect(exchangeLayer).toHaveAttribute('aria-label', '弃掷逦迤 弃牌动画');
    await expect(exchangeLayer.locator('.exchange-flying-card')).toHaveCount(4);
    await expect(page.getByRole('button', { name: /弃掷逦迤 · 暗弃中/ })).toBeDisabled();
    await page.screenshot({
      path: testInfo.outputPath('lingering-discard-animation.png'),
      animations: 'allow'
    });

    await page.evaluate(async () => {
      const socketService = (await import('/src/services/socket.js')).default;
      socketService.socket.listeners('last_stand_decision_required').forEach(listener => listener({
        cardsCount: 7,
        suit: 'diamonds'
      }));
    });
    const lastStandDialog = page.getByRole('dialog', { name: '绝处逢生' });
    await expect(lastStandDialog).toBeVisible();
    const lastStandBox = await lastStandDialog.boundingBox();
    expect(lastStandBox.y).toBeGreaterThan(360);
    expect(lastStandBox.height).toBeLessThan(260);
    await expect(lastStandDialog).toContainText('7 张同花色手牌且没有主牌');
    await expect(lastStandDialog.getByRole('button', { name: /^发\s*动$/ })).toBeVisible();
    await expect(lastStandDialog.getByRole('button', { name: /^暂\s*不\s*发\s*动$/ })).toBeVisible();
    await lastStandDialog.locator('.ant-modal-content').screenshot({
      path: testInfo.outputPath('last-stand-decision.png')
    });
  } finally {
    await context.close();
  }
});

test('无人生还在本人视角始终明置自己的跟牌，并只在轮末显示本轮分数', async ({ browser }) => {
  test.setTimeout(120_000);
  const { context, pages } = await openTestModeGame(browser, '无人生还');
  const page = pages[0];

  try {
    await finishDealerBury(pages);
    await page.evaluate(async () => {
      const { useGameStore } = await import('/src/store/gameStore.js');
      const socketService = (await import('/src/services/socket.js')).default;
      const state = useGameStore.getState();
      const players = state.currentRoom.players;
      const emitLocal = (event, payload) => {
        socketService.socket.listeners(event).forEach(listener => listener(payload));
      };
      const cards = [
        { id: 'no-one-leader-5', suit: 'hearts', rank: '5', copyIndex: 300 },
        { id: 'no-one-own-10', suit: 'hearts', rank: '10', copyIndex: 301 },
        { id: 'no-one-third-3', suit: 'hearts', rank: '3', copyIndex: 302 },
        { id: 'no-one-fourth-4', suit: 'hearts', rank: '4', copyIndex: 303 }
      ];

      emitLocal('cards_played', {
        playerId: players[1].id,
        playerName: players[1].name,
        cards: [cards[0]],
        cardsCount: 1,
        concealed: false,
        currentWinningPlayerId: players[1].id
      });
      emitLocal('concealed_cards_played_private', {
        playerId: players[0].id,
        cards: [cards[1]]
      });
      emitLocal('cards_played', {
        playerId: players[0].id,
        playerName: players[0].name,
        cards: [],
        removedCardIds: [cards[1].id],
        cardsCount: 1,
        concealed: true,
        currentWinningPlayerId: null
      });
      [2, 3].forEach((playerIndex, offset) => emitLocal('cards_played', {
        playerId: players[playerIndex].id,
        playerName: players[playerIndex].name,
        cards: [],
        removedCardIds: [cards[offset + 2].id],
        cardsCount: 1,
        concealed: true,
        currentWinningPlayerId: null
      }));

      window.__noOneSurvivesReveal = () => emitLocal('concealed_plays_revealed', {
        plays: players.map((player, index) => ({
          playerId: player.id,
          concealed: index !== 1,
          cards: [cards[index === 0 ? 1 : index === 1 ? 0 : index]]
        }))
      });
    });

    const ownPlay = page.locator('.played-cards-bottom');
    await expect(ownPlay.locator('.card')).toHaveCount(1);
    await expect(ownPlay.locator('.concealed-play-stack')).toHaveCount(0);
    await expect(page.locator('.round-points-indicator')).toHaveCount(0);

    await page.evaluate(() => window.__noOneSurvivesReveal());

    await expect(page.locator('.round-points-value')).toHaveText('15');
    await expect(ownPlay).not.toHaveClass(/concealed-just-revealed/);
    await expect(page.locator('.concealed-just-revealed')).toHaveCount(2);
  } finally {
    await context.close();
  }
});

test('暗度陈仓和偷梁换柱发动后主操作仍称为出牌', async ({ browser }) => {
  test.setTimeout(180_000);

  const concealedGame = await openTestModeGame(browser, '暗度陈仓');
  try {
    const dealerPageIndex = await finishDealerBury(concealedGame.pages);
    const dealerPage = concealedGame.pages[dealerPageIndex];
    await dealerPage.locator('.my-hand .card').first().dispatchEvent('click');
    const dealerPlayButton = dealerPage.getByRole('button', { name: '出牌(1)', exact: true });
    await expect(dealerPlayButton).toBeEnabled();
    await dealerPlayButton.click();

    const followerPage = concealedGame.pages[(dealerPageIndex + 1) % 4];
    const concealedSkillButton = followerPage.getByRole('button', { name: '暗度陈仓', exact: true });
    await expect(concealedSkillButton).toBeEnabled();
    await concealedSkillButton.click();
    await expect(followerPage.getByRole('button', { name: '出牌(0)', exact: true })).toBeVisible();
    await expect(followerPage.getByRole('button', { name: /垫牌\(/ })).toHaveCount(0);
  } finally {
    await concealedGame.context.close();
  }

  const stealingGame = await openTestModeGame(browser, '偷梁换柱');
  try {
    const dealerPageIndex = await finishDealerBury(stealingGame.pages);
    const dealerPage = stealingGame.pages[dealerPageIndex];
    const stealingSkillButton = dealerPage.getByRole('button', { name: '偷梁换柱', exact: true });
    await expect(stealingSkillButton).toBeEnabled();
    await stealingSkillButton.click();
    await expect(dealerPage.getByRole('button', { name: '出牌(0)', exact: true })).toBeVisible();
    await expect(dealerPage.getByRole('button', { name: /垫牌\(/ })).toHaveCount(0);
  } finally {
    await stealingGame.context.close();
  }
});

test('后发制人在三号位确认后改为四号先出，取消不消耗机会', async ({ browser }, testInfo) => {
  test.setTimeout(180_000);
  const { context, pages } = await openTestModeGame(browser, '后发制人');

  try {
    await Promise.all(pages.map(page => page.setViewportSize({ width: 1440, height: 900 })));
    const firstPlayerIndex = await finishDealerBury(pages);
    const secondPlayerIndex = (firstPlayerIndex + 1) % 4;
    const thirdPlayerIndex = (firstPlayerIndex + 2) % 4;
    const fourthPlayerIndex = (firstPlayerIndex + 3) % 4;

    await playLegalSingle(pages[firstPlayerIndex]);
    await playLegalSingle(pages[secondPlayerIndex]);

    const thirdPage = pages[thirdPlayerIndex];
    const fourthPage = pages[fourthPlayerIndex];
    const skillButton = thirdPage.getByRole('button', { name: '后发制人', exact: true });
    await expect(skillButton).toBeEnabled();
    await expect(skillButton).toHaveClass(/is-ready/);

    await skillButton.click();
    const dialog = thirdPage.getByRole('dialog', { name: '后发制人' });
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText('只改变牌序，不改变牌的大小');
    const dialogBox = await dialog.boundingBox();
    expect(dialogBox.y).toBeGreaterThan(400);
    expect(dialogBox.height).toBeLessThan(240);
    await dialog.screenshot({ path: testInfo.outputPath('late-mover-decision.png') });

    await dialog.getByRole('button', { name: '否，保持当前牌序', exact: true }).click();
    await expect(dialog).toBeHidden();
    await expect(skillButton).toBeEnabled();
    await expect(skillButton).toHaveClass(/is-ready/);
    await expect(skillButton).not.toHaveClass(/is-used/);

    await skillButton.click();
    await dialog.getByRole('button', { name: '是，让下家先出', exact: true }).click();
    await expect(fourthPage.locator('.player-bottom.current-turn')).toBeVisible();
    await expect(thirdPage.locator('.player-bottom.current-turn')).toHaveCount(0);
    await expect(skillButton).toBeDisabled();
    await expect(skillButton).toHaveClass(/is-used/);

    await playLegalSingle(fourthPage);
    await expect(thirdPage.locator('.player-bottom.current-turn')).toBeVisible();
    await expect(fourthPage.locator('.player-bottom.current-turn')).toHaveCount(0);
    await playLegalSingle(thirdPage);
  } finally {
    await context.close();
  }
});

test('一马当先只把首轮出牌权交给庄家队友，庄家仍保留底牌权限', async ({ browser }, testInfo) => {
  test.setTimeout(120_000);
  const { context, pages } = await openTestModeGame(browser, '一马当先');

  try {
    let dealerPageIndex = -1;
    await expect.poll(async () => {
      for (let index = 0; index < pages.length; index += 1) {
        if (await pages[index].locator('.player-bottom').getByText('庄', { exact: true }).isVisible().catch(() => false)) {
          return index;
        }
      }
      return -1;
    }, { timeout: 25_000 }).toBeGreaterThanOrEqual(0);
    for (let index = 0; index < pages.length; index += 1) {
      if (await pages[index].locator('.player-bottom').getByText('庄', { exact: true }).isVisible().catch(() => false)) {
        dealerPageIndex = index;
        break;
      }
    }

    const dealerPage = pages[dealerPageIndex];
    const teammatePage = pages[(dealerPageIndex + 2) % 4];
    const dealerCards = dealerPage.locator('.my-hand .card');
    await expect(dealerCards).toHaveCount(33);
    for (let cardIndex = 0; cardIndex < 8; cardIndex += 1) {
      await dealerCards.nth(cardIndex).dispatchEvent('click');
    }
    await dealerPage.getByRole('button', { name: '埋底(8/8)' }).click();

    await expect(teammatePage.locator('.player-bottom.current-turn')).toBeVisible();
    await expect(dealerPage.locator('.player-bottom.current-turn')).toHaveCount(0);
    await expect(dealerPage.locator('.player-bottom').getByText('庄', { exact: true })).toBeVisible();
    await expect(dealerPage.getByRole('button', { name: '查看底牌' })).toBeVisible();
    await expect(teammatePage.getByRole('button', { name: '查看底牌' })).toHaveCount(0);
    await dealerPage.locator('.game-table').screenshot({
      path: testInfo.outputPath('one-horse-dealer-remains-dealer.png')
    });
  } finally {
    await context.close();
  }
});

test('迷雾牌只在终局结算中以紧凑横栏公开并补分', async ({ browser }, testInfo) => {
  test.setTimeout(120_000);
  const { context, pages } = await openTestModeGame(browser, '迷雾重重', {
    initialHandCount: 23
  });

  try {
    await Promise.all(pages.map(page => page.setViewportSize({ width: 1440, height: 900 })));
    await finishDealerBury(pages, { initialHandCount: 23 });
    await pages[0].evaluate(async () => {
      const { useGameStore } = await import('/src/store/gameStore.js');
      const socketService = (await import('/src/services/socket.js')).default;
      const state = useGameStore.getState();
      useGameStore.setState({
        currentRoom: {
          ...state.currentRoom,
          gameState: {
            ...state.currentRoom.gameState,
            phase: 'revealing',
            attackerScore: 82.5
          }
        }
      });
      const bottomCards = ['5', '2', '3', '4', '6', '7', '8', '9'].map((rank, index) => ({
        id: `fog-bottom-${index}`,
        suit: index % 2 === 0 ? 'diamonds' : 'clubs',
        rank,
        copyIndex: index
      }));
      const mistyFogCards = ['5', '10', 'K', '3', '4', '6', '8', 'Q'].map((rank, index) => ({
        id: `fog-hidden-${index}`,
        suit: index < 4 ? 'hearts' : 'spades',
        rank,
        copyIndex: index
      }));
      socketService.socket.listeners('bottom_revealed').forEach(listener => listener({
        bottomCards,
        bottomScoreResult: {
          attackerWonBottom: true,
          resultText: '闲家拿底',
          bottomPoints: 5,
          bottomMultiplier: 2,
          bottomScoreGained: 10,
          scoreBeforeMistyFog: 70,
          mistyFogCards,
          mistyFogPoints: 25,
          mistyFogBonus: 12.5,
          totalScore: 82.5,
          collectedPointCards: []
        },
        upgradeResult: {
          attackerWon: true,
          oldDealerLevel: 2,
          newDealerLevel: 2,
          dealerLevelUp: 0,
          oldAttackerLevel: 2,
          newAttackerLevel: 2,
          attackerLevelUp: 0,
          nextDealerName: '玩家2',
          nextDealerLevel: 2
        }
      }));
    });

    const settlementCenter = pages[0].locator('.settlement-table-center');
    const settlementPanel = pages[0].locator('.settlement-panel');
    const fogSummary = pages[0].locator('.settlement-misty-fog');
    await expect(fogSummary).toBeVisible();
    await expect(fogSummary).toContainText('迷雾牌 · 终局公开');
    await expect(fogSummary).toContainText('牌面 25 分');
    await expect(fogSummary).toContainText('闲家补 +12.5 分');
    await expect(fogSummary).toContainText('最终 82.5 分');
    await expect(fogSummary.locator('.card')).toHaveCount(8);
    await expect.poll(async () => fogSummary.evaluate((element) => {
      const cards = [...element.querySelectorAll('.card')];
      const containerRight = element.getBoundingClientRect().right;
      const rightmostCard = cards.at(-1).getBoundingClientRect();
      return rightmostCard.right <= containerRight - 8
        && cards.slice(0, -1).every((card, index) => {
        const corner = card.querySelector('.card-corner.top-left');
        const centerSuit = card.querySelector('.card-center');
        const nextCard = cards[index + 1];
        const nextCardLeft = nextCard.getBoundingClientRect().left;
        const centerSuitRect = centerSuit.getBoundingClientRect();
        return corner.getBoundingClientRect().right <= nextCardLeft
          && nextCardLeft <= centerSuitRect.left + centerSuitRect.width / 2;
        });
    })).toBe(true);
    await expect(pages[0].locator('.settlement-bottom-result')).toContainText('闲家总分：70 分');
    await expect.poll(async () => {
      const centerBox = await settlementCenter.boundingBox();
      const panelBox = await settlementPanel.boundingBox();
      const fogBox = await fogSummary.boundingBox();
      const fogContentFits = await fogSummary.evaluate(element => {
        const container = element.getBoundingClientRect();
        return [...element.querySelectorAll('.card, .settlement-misty-fog-summary')]
          .every((child) => {
            const rect = child.getBoundingClientRect();
            return rect.left >= container.left - 1
              && rect.right <= container.right + 1
              && rect.top >= container.top - 1
              && rect.bottom <= container.bottom + 1;
          });
      });
      if (!centerBox || !panelBox || !fogBox) return false;
      return panelBox.width <= 520
        && panelBox.y >= centerBox.y
        && panelBox.y + panelBox.height <= centerBox.y + centerBox.height
        && fogBox.x >= panelBox.x
        && fogBox.x + fogBox.width <= panelBox.x + panelBox.width
        && fogContentFits;
    }).toBe(true);
    await pages[0].locator('.game-table').screenshot({
      path: testInfo.outputPath('heavy-fog-settlement.png')
    });

    await pages[0].evaluate(async () => {
      const socketService = (await import('/src/services/socket.js')).default;
      const bottomCards = ['5', '2', '3', '4', '6', '7', '8', '9'].map((rank, index) => ({
        id: `discard-bottom-${index}`,
        suit: index % 2 === 0 ? 'diamonds' : 'clubs',
        rank,
        copyIndex: index
      }));
      const lingeringDiscardCards = ['10', '5', 'K'].map((rank, index) => ({
        id: `dealer-discard-${index}`,
        suit: index < 4 ? 'hearts' : 'spades',
        rank,
        copyIndex: index
      }));
      socketService.socket.listeners('bottom_revealed').forEach(listener => listener({
        bottomCards,
        bottomScoreResult: {
          attackerWonBottom: false,
          resultText: '庄家守底',
          bottomPoints: 5,
          bottomMultiplier: 2,
          bottomScoreGained: 0,
          scoreBeforeLingeringDiscard: 70,
          lingeringDiscardCards,
          lingeringDiscardPoints: 25,
          lingeringDiscardBonus: 25,
          totalScore: 95,
          collectedPointCards: []
        },
        upgradeResult: {
          attackerWon: true,
          oldDealerLevel: 2,
          newDealerLevel: 2,
          dealerLevelUp: 0,
          oldAttackerLevel: 2,
          newAttackerLevel: 2,
          attackerLevelUp: 0,
          nextDealerName: '玩家2',
          nextDealerLevel: 2
        }
      }));
    });
    const discardSummary = pages[0].locator('.settlement-lingering-discard');
    await expect(discardSummary).toBeVisible();
    await expect(discardSummary).toContainText('弃掷逦迤 · 分牌公开');
    await expect(discardSummary).toContainText('闲家补 +25 分');
    await expect(discardSummary.locator('.card')).toHaveCount(3);
    await expect(pages[0].locator('.settlement-bottom-result')).toContainText('闲家总分：70 分');
    await expect.poll(async () => discardSummary.evaluate(element => {
      const container = element.getBoundingClientRect();
      return [...element.querySelectorAll('.card, .settlement-misty-fog-summary')]
        .every((child) => {
          const rect = child.getBoundingClientRect();
          return rect.left >= container.left - 1
            && rect.right <= container.right + 1
            && rect.top >= container.top - 1
            && rect.bottom <= container.bottom + 1;
        });
    })).toBe(true);
    await pages[0].locator('.game-table').screenshot({
      path: testInfo.outputPath('lingering-discard-settlement.png')
    });
  } finally {
    await context.close();
  }
});

test('改革开放由庄家队友接过八张底牌再埋，最后仍由庄家首发', async ({ browser }, testInfo) => {
  test.setTimeout(120_000);
  const { context, pages } = await openTestModeGame(browser, '改革开放');

  try {
    await Promise.all(pages.map(page => page.setViewportSize({ width: 1440, height: 900 })));
    let dealerPageIndex = -1;
    await expect.poll(async () => {
      for (let index = 0; index < pages.length; index += 1) {
        const dealerBadge = pages[index].locator('.player-bottom').getByText('庄', { exact: true });
        if (await dealerBadge.isVisible().catch(() => false)) return index;
      }
      return -1;
    }, { timeout: 25_000 }).toBeGreaterThanOrEqual(0);
    for (let index = 0; index < pages.length; index += 1) {
      if (await pages[index].locator('.player-bottom').getByText('庄', { exact: true }).isVisible().catch(() => false)) {
        dealerPageIndex = index;
        break;
      }
    }

    const teammatePageIndex = (dealerPageIndex + 2) % 4;
    const dealerPage = pages[dealerPageIndex];
    const teammatePage = pages[teammatePageIndex];
    await Promise.all(pages.map(page =>
      expect(page.locator('.score-panel').getByText('40 分', { exact: true })).toBeVisible()
    ));
    await expect(dealerPage.locator('.my-hand .card')).toHaveCount(33);
    await expect(teammatePage.locator('.my-hand .card')).toHaveCount(25);

    const dealerCards = dealerPage.locator('.my-hand .card');
    const firstBottomIds = [];
    for (let index = 0; index < 8; index += 1) {
      firstBottomIds.push(await dealerCards.nth(index).getAttribute('data-card-id'));
      await dealerCards.nth(index).dispatchEvent('click');
    }
    await dealerPage.getByRole('button', { name: '埋底(8/8)' }).click();

    await Promise.all(pages.map(async page => {
      const animation = page.locator('.card-exchange-animation-layer');
      await expect(animation).toBeVisible();
      await expect(animation.locator('.exchange-flying-card')).toHaveCount(8);
      await expect(animation).toHaveAttribute('aria-label', '改革开放 · 底牌交接 换牌动画');
    }));
    await teammatePage.locator('.card-exchange-animation-layer').screenshot({
      path: testInfo.outputPath('reform-bottom-transfer.png')
    });
    await expect(teammatePage.locator('.my-hand .card')).toHaveCount(33);
    const teammateHandAfterTransfer = await teammatePage.locator('.my-hand .card').evaluateAll(cards =>
      cards.map(card => card.dataset.cardId)
    );
    firstBottomIds.forEach(cardId => expect(teammateHandAfterTransfer).toContain(cardId));
    await Promise.all(pages.map(page =>
      expect(page.locator('.card-exchange-animation-layer')).toBeHidden({ timeout: 5_000 })
    ));

    await expect(teammatePage.getByRole('button', { name: '再埋底(0/8)' })).toBeDisabled();
    await expect(dealerPage.getByRole('button', { name: /等待 .* 再埋底/ })).toBeDisabled();
    const teammateCards = teammatePage.locator('.my-hand .card');
    for (let index = 0; index < 8; index += 1) {
      await teammateCards.nth(index).dispatchEvent('click');
    }
    await teammatePage.getByRole('button', { name: '再埋底(8/8)' }).click();

    await Promise.all(pages.map(page =>
      expect(page.locator('.my-hand .card')).toHaveCount(25)
    ));
    await expect(dealerPage.locator('.player-bottom.current-turn')).toBeVisible();
    await expect(teammatePage.locator('.player-bottom.current-turn')).toHaveCount(0);
    await expect(dealerPage.getByRole('button', { name: /^出牌\(0\)$/ })).toBeVisible();
  } finally {
    await context.close();
  }
});

test('李代桃僵以灰色主动技能按钮发动，任意垫出的主牌仍视为小', async ({ browser }, testInfo) => {
  test.setTimeout(120_000);
  const { context, pages } = await openTestModeGame(browser, '李代桃僵');

  try {
    await Promise.all(pages.map(page => page.setViewportSize({ width: 1440, height: 900 })));
    const dealerPageIndex = await finishDealerBury(pages);
    const followerPageIndex = (dealerPageIndex + 1) % 4;
    const dealerPage = pages[dealerPageIndex];
    const followerPage = pages[followerPageIndex];

    const dealerCards = await dealerPage.locator('.my-hand .card').evaluateAll(cards => cards.map(card => ({
      id: card.dataset.cardId,
      suit: card.dataset.cardId.split('-')[0],
      isTrump: Boolean(card.querySelector('.trump-badge'))
    })));
    const followerCards = await followerPage.locator('.my-hand .card').evaluateAll(cards => cards.map(card => ({
      id: card.dataset.cardId,
      suit: card.dataset.cardId.split('-')[0],
      isTrump: Boolean(card.querySelector('.trump-badge'))
    })));
    const trumpDiscard = followerCards.find(card => card.isTrump);
    const leadCard = dealerCards.find(card =>
      !card.isTrump && followerCards.some(followerCard =>
        !followerCard.isTrump && followerCard.suit === card.suit
      )
    );
    expect(trumpDiscard).toBeTruthy();
    expect(leadCard).toBeTruthy();
    const protectedFollower = followerCards.find(card =>
      !card.isTrump && card.suit === leadCard.suit
    );

    const dealerSkillButton = dealerPage.getByRole('button', { name: '李代桃僵', exact: true });
    await expect(dealerSkillButton).toBeDisabled();
    await expect(dealerSkillButton).toHaveAttribute('aria-pressed', 'false');
    await dealerPage.locator(`.my-hand .card[data-card-id="${leadCard.id}"]`).dispatchEvent('click');
    await dealerPage.getByRole('button', { name: '出牌(1)', exact: true }).click();

    await expect(followerPage.locator('.player-bottom.current-turn')).toBeVisible();
    const skillButton = followerPage.getByRole('button', { name: '李代桃僵', exact: true });
    await expect(skillButton).toBeEnabled();
    await expect(skillButton).toHaveAttribute('aria-pressed', 'false');
    await expect(skillButton).not.toHaveClass(/is-armed/);
    const idleSkillBackground = await skillButton.evaluate(button => getComputedStyle(button).backgroundImage);

    for (const selectedCard of await followerPage.locator('.my-hand .card.selected').all()) {
      await selectedCard.dispatchEvent('click');
    }
    await followerPage.locator(`.my-hand .card[data-card-id="${trumpDiscard.id}"]`).dispatchEvent('click');
    await expect(followerPage.getByRole('button', { name: '出牌(1)', exact: true })).toBeDisabled();

    await skillButton.click();
    await expect(skillButton).toHaveClass(/is-armed/);
    await expect(skillButton).toHaveAttribute('aria-pressed', 'true');
    expect(await skillButton.evaluate(button => getComputedStyle(button).backgroundImage)).not.toBe(idleSkillBackground);
    await expect(followerPage.getByRole('button', { name: '垫牌(0)', exact: true })).toBeDisabled();
    await followerPage.locator(`.my-hand .card[data-card-id="${trumpDiscard.id}"]`).dispatchEvent('click');
    const discardButton = followerPage.getByRole('button', { name: '垫牌(1)', exact: true });
    await expect(discardButton).toBeEnabled();
    await followerPage.locator('.player-bottom').screenshot({
      path: testInfo.outputPath('substitute-sacrifice-armed-button.png')
    });
    await discardButton.click();

    await Promise.all(pages.map(page =>
      expect(page.locator('.active-skill-activation')).toBeVisible()
    ));
    await followerPage.waitForTimeout(260);
    await followerPage.screenshot({
      path: testInfo.outputPath('substitute-sacrifice-activation.png'),
      animations: 'allow'
    });
    await expect(followerPage.locator('.position-bottom .played-cards-area')).toHaveAttribute('data-treated-as-small', 'true');
    await expect(followerPage.locator('.position-bottom .active-skill-play-badge')).toHaveText('李代桃僵 · 小');
    await expect(dealerPage.locator('.position-bottom .played-cards-area')).toHaveClass(/winning-play/);
    await expect(followerPage.locator(`.my-hand .card[data-card-id="${protectedFollower.id}"]`)).toHaveCount(1);
    await expect(skillButton).toBeDisabled();
    await expect(skillButton).toHaveClass(/is-used/);
    await expect(followerPage.locator('.active-skill-activation-overlay')).toBeHidden({ timeout: 3_000 });
    await followerPage.locator('.game-table').screenshot({
      path: testInfo.outputPath('substitute-sacrifice-treated-small.png')
    });
  } finally {
    await context.close();
  }
});

test('时间倒流允许多人预备，并可在第四家出完后的窗口加入', async ({ browser }, testInfo) => {
  test.setTimeout(150_000);
  const { context, pages } = await openTestModeGame(browser, '时间倒流');

  try {
    await Promise.all(pages.map(page => page.setViewportSize({ width: 1440, height: 900 })));
    const dealerPageIndex = await finishDealerBury(pages);
    const activatorPageIndex = (dealerPageIndex + 2) % pages.length;
    const lateActivatorPageIndex = (dealerPageIndex + 1) % pages.length;
    const activatorPage = pages[activatorPageIndex];
    const lateActivatorPage = pages[lateActivatorPageIndex];
    const dealerPage = pages[dealerPageIndex];
    const skillButton = activatorPage.getByRole('button', { name: '时间倒流', exact: true });

    await expect(dealerPage.locator('.player-bottom.current-turn')).toBeVisible();
    await expect(activatorPage.locator('.player-bottom.current-turn')).toHaveCount(0);
    await expect(skillButton).toBeEnabled();
    await skillButton.click();
    await expect(skillButton).toHaveAttribute('aria-pressed', 'true');
    await expect(skillButton).toHaveClass(/is-armed/);
    await expect(lateActivatorPage.getByRole('button', { name: '时间倒流', exact: true })).toBeEnabled();

    for (let playIndex = 0; playIndex < 4; playIndex += 1) {
      let turnPage = null;
      await expect.poll(async () => {
        for (const page of pages) {
          if (await page.locator('.player-bottom.current-turn').isVisible().catch(() => false)) {
            turnPage = page;
            return true;
          }
        }
        return false;
      }).toBe(true);
      await playLegalSingle(turnPage);
      if (playIndex < 3) {
        await expect(turnPage.locator('.player-bottom.current-turn')).toBeHidden();
      }
    }

    await expect(activatorPage.locator('.played-cards-area .card')).toHaveCount(4);
    await activatorPage.waitForTimeout(1050);
    // 普通规则在 1 秒时已经清桌；时间倒流此时仍处于刚结束这一轮的预备窗口。
    await expect(activatorPage.locator('.played-cards-area .card')).toHaveCount(4);
    const lateSkillButton = lateActivatorPage.getByRole('button', { name: '时间倒流', exact: true });
    await expect(lateSkillButton).toBeEnabled();
    await lateSkillButton.click();
    await expect(lateSkillButton).toHaveAttribute('aria-pressed', 'true');
    await expect(lateSkillButton).toHaveClass(/is-armed/);

    const dialog = activatorPage.getByRole('dialog', { name: '时间倒流' });
    const lateDialog = lateActivatorPage.getByRole('dialog', { name: '时间倒流' });
    await expect(dialog).toBeVisible({ timeout: 3_000 });
    await expect(lateDialog).toBeVisible({ timeout: 3_000 });
    let pendingTurnPage = null;
    await expect.poll(async () => {
      for (const page of pages) {
        if (await page.locator('.player-bottom.current-turn').isVisible().catch(() => false)) {
          pendingTurnPage = page;
          return true;
        }
      }
      return false;
    }).toBe(true);
    const pendingHandCount = await pendingTurnPage.locator('.my-hand .card').count();
    await expect(pendingTurnPage.getByRole('button', { name: /^出牌\(\d+\)$/ })).toBeDisabled();
    await expect(pendingTurnPage.locator('.my-hand .card').first()).toHaveAttribute('aria-disabled', 'true');
    await pendingTurnPage.locator('.my-hand .card').first().dispatchEvent('click');
    await expect(pendingTurnPage.locator('.my-hand .card.selected')).toHaveCount(0);
    await expect(pendingTurnPage.locator('.my-hand .card')).toHaveCount(pendingHandCount);
    await expect(dialog).toContainText('收回本轮四家的出牌并重新出牌');
    const dialogBox = await dialog.boundingBox();
    expect(dialogBox.y).toBeGreaterThan(350);
    await activatorPage.screenshot({
      path: testInfo.outputPath('time-reversal-decision.png')
    });

    await lateDialog.getByRole('button', { name: '倒流，重打本轮' }).click();
    await expect(dialog).toBeHidden();
    await Promise.all(pages.map(page =>
      expect(page.locator('.my-hand .card')).toHaveCount(25)
    ));
    await Promise.all(pages.map(page =>
      expect(page.locator('.played-cards-area .card')).toHaveCount(0)
    ));
    await expect(dealerPage.locator('.player-bottom.current-turn')).toBeVisible();
    await expect(skillButton).toBeDisabled();
    await expect(skillButton).not.toHaveClass(/is-used/);
    await expect(lateSkillButton).toBeDisabled();
    await expect(lateSkillButton).toHaveClass(/is-used/);
  } finally {
    await context.close();
  }
});

test.describe.serial('三条开局换牌规则', () => {
  for (const [ruleName, rule] of Object.entries(openingExchangeRules)) {
    test(`${ruleName} 在四个真实页面中完成选牌、动画和手牌交换`, async ({ browser }, testInfo) => {
      test.setTimeout(180_000);
      const { context, pages } = await openGameOfferingRule(browser, ruleName, rule.id);

      try {
        await Promise.all(pages.map((playerPage) =>
          playerPage.getByRole('button', { name: /准\s*备/ }).click()
        ));
        await Promise.all(pages.map((playerPage) =>
          expect(playerPage.locator('.my-hand .card')).toHaveCount(25, { timeout: 15_000 })
        ));

        const initialHands = await Promise.all(pages.map((playerPage) =>
          playerPage.locator('.my-hand .card').evaluateAll((cards) =>
            cards.map((card) => card.dataset.cardId)
          )
        ));
        const sentCards = initialHands.map((hand) => hand.slice(0, 2));

        for (let playerIndex = 0; playerIndex < pages.length; playerIndex += 1) {
          const targetIndex = (playerIndex + rule.targetOffset + pages.length) % pages.length;
          await expect(pages[playerIndex].getByText(
            `请选择 2 张牌交给 玩家${targetIndex + 1}`,
            { exact: true }
          )).toBeVisible({ timeout: 20_000 });
          await expect(pages[playerIndex].locator('.declaration-slot.active')).toHaveCount(0);
          const cards = pages[playerIndex].locator('.my-hand .card');
          // 手牌有重叠，普通坐标点击可能命中盖在上面的牌；直接向目标 DOM 分发点击。
          await cards.nth(0).dispatchEvent('click');
          await cards.nth(1).dispatchEvent('click');
          const selectedIds = await pages[playerIndex]
            .locator('.my-hand .card.selected')
            .evaluateAll((cards) => cards.map((card) => card.dataset.cardId));
          expect(new Set(selectedIds)).toEqual(new Set(sentCards[playerIndex]));
          await expect(pages[playerIndex].getByRole('button', { name: '确认换牌(2/2)' })).toBeEnabled();
        }

        for (let playerIndex = 0; playerIndex < pages.length - 1; playerIndex += 1) {
          await pages[playerIndex].getByRole('button', { name: '确认换牌(2/2)' }).click();
        }
        await expect(pages[0].getByText(/等待其他玩家 · 3\/4/)).toBeVisible();

        await pages[3].getByRole('button', { name: '确认换牌(2/2)' }).click();
        await Promise.all(pages.map((playerPage) =>
          expect(playerPage.locator('.card-exchange-animation-layer')).toBeVisible()
        ));
        await Promise.all(pages.map((playerPage) =>
          expect(playerPage.locator('.exchange-flying-card')).toHaveCount(8)
        ));

        const ownOutgoingPath = await pages[0].locator('.exchange-flying-card').evaluateAll((cards) =>
          cards.map((card) => {
            const style = getComputedStyle(card);
            return {
              startX: style.getPropertyValue('--exchange-start-x').trim(),
              startY: style.getPropertyValue('--exchange-start-y').trim(),
              endX: style.getPropertyValue('--exchange-end-x').trim(),
              endY: style.getPropertyValue('--exchange-end-y').trim()
            };
          }).filter(({ startX, startY }) => startX === '50%' && startY === '91%')
        );
        expect(ownOutgoingPath).toHaveLength(2);
        expect(ownOutgoingPath.every(({ endX, endY }) =>
          endX === rule.endX && endY === rule.endY
        )).toBe(true);

        await pages[0].locator('.game-table').screenshot({
          path: testInfo.outputPath(`${ruleName}-card-exchange.png`),
          animations: 'allow'
        });
        await Promise.all(pages.map((playerPage) =>
          expect(playerPage.locator('.card-exchange-animation-layer')).toBeHidden({ timeout: 5_000 })
        ));

        const finalHands = await Promise.all(pages.map((playerPage) =>
          playerPage.locator('.my-hand .card').evaluateAll((cards) =>
            cards.map((card) => card.dataset.cardId)
          )
        ));
        let dealerPageIndex = -1;
        for (let index = 0; index < pages.length; index += 1) {
          if (await pages[index].locator('.player-bottom').getByText('庄', { exact: true }).isVisible().catch(() => false)) {
            dealerPageIndex = index;
            break;
          }
        }
        expect(dealerPageIndex).toBeGreaterThanOrEqual(0);
        finalHands.forEach((hand, playerIndex) => {
          expect(hand).toHaveLength(playerIndex === dealerPageIndex ? 33 : 25);
          sentCards[playerIndex].forEach((cardId) => expect(hand).not.toContain(cardId));
          const senderIndex = (playerIndex + rule.incomingOffset + pages.length) % pages.length;
          sentCards[senderIndex].forEach((cardId) => expect(hand).toContain(cardId));
        });
      } finally {
        await context.close();
      }
    });
  }
});

test('算无遗策在四个页面中展示差异化明牌，并由庄家代打', async ({ browser }, testInfo) => {
  test.setTimeout(180_000);
  const { context, pages } = await openGameOfferingRule(browser, '算无遗策', 'perfect_strategy');

  try {
    await Promise.all(pages.map((playerPage) => playerPage.setViewportSize({ width: 1600, height: 1000 })));
    await Promise.all(pages.map((playerPage) =>
      playerPage.getByRole('button', { name: /准\s*备/ }).click()
    ));

    let dealerPageIndex = -1;
    await expect.poll(async () => {
      for (let index = 0; index < pages.length; index += 1) {
        if (await pages[index].locator('.player-bottom').getByText('庄', { exact: true }).isVisible().catch(() => false)) {
          return index;
        }
      }
      return -1;
    }, { timeout: 25_000 }).toBeGreaterThanOrEqual(0);

    for (let index = 0; index < pages.length; index += 1) {
      if (await pages[index].locator('.player-bottom').getByText('庄', { exact: true }).isVisible().catch(() => false)) {
        dealerPageIndex = index;
        break;
      }
    }

    const dealerPage = pages[dealerPageIndex];
    const openPlayerIndex = (dealerPageIndex + 2) % 4;
    const openPlayerPage = pages[openPlayerIndex];
    const firstAttackerIndex = (dealerPageIndex + 1) % 4;
    const secondAttackerIndex = (dealerPageIndex + 3) % 4;
    const firstAttackerPage = pages[firstAttackerIndex];
    const secondAttackerPage = pages[secondAttackerIndex];
    const openPlayerName = `玩家${openPlayerIndex + 1}`;

    // 埋底阶段任何视角都不能看到明手身份或牌面。
    await Promise.all(pages.map(async (playerPage) => {
      await expect(playerPage.locator('.open-hand-panel')).toHaveCount(0);
      await expect(playerPage.locator('.open-hand-self-status')).toHaveCount(0);
      await expect(playerPage.locator('.open-hand-avatar-badge')).toHaveCount(0);
    }));
    await expect(dealerPage.locator('.score-panel').getByText('10 分', { exact: true })).toBeVisible();

    const dealerCards = dealerPage.locator('.my-hand .card');
    await expect(dealerCards).toHaveCount(33);
    for (let cardIndex = 0; cardIndex < 8; cardIndex += 1) {
      await dealerCards.nth(cardIndex).dispatchEvent('click');
    }
    await dealerPage.getByRole('button', { name: '埋底(8/8)' }).click();

    // 正式进入出牌阶段后才公开庄家队友的手牌。
    const dealerOpenHand = dealerPage.locator('[data-open-hand-position="top"]');
    await expect(dealerOpenHand).toBeVisible();
    await expect(dealerOpenHand.locator('.card')).toHaveCount(25);
    await dealerPage.setViewportSize({ width: 667, height: 375 });
    const mobileOpenHandGeometry = await dealerPage.evaluate(() => {
      const rect = selector => {
        const element = document.querySelector(selector);
        if (!element) return null;
        const box = element.getBoundingClientRect();
        return { top: box.top, right: box.right, bottom: box.bottom, left: box.left };
      };
      const overlaps = (first, second) => Boolean(
        first && second
        && first.left < second.right
        && first.right > second.left
        && first.top < second.bottom
        && first.bottom > second.top
      );
      const panel = rect('[data-open-hand-position="top"]');
      const cards = Array.from(document.querySelectorAll('[data-open-hand-position="top"] .card-wrapper'))
        .map(card => {
          const box = card.getBoundingClientRect();
          return { top: box.top, right: box.right, bottom: box.bottom, left: box.left };
        });
      return {
        panel,
        cards,
        viewport: { width: window.innerWidth, height: window.innerHeight },
        documentWidth: document.documentElement.scrollWidth,
        scrollX: window.scrollX,
        overlapsScore: overlaps(panel, rect('.score-panel')),
        overlapsRules: overlaps(panel, rect('.center-content.table-tools')),
        overlapsBottomPlayer: overlaps(panel, rect('.player-bottom')),
        overlapsTopPlay: overlaps(panel, rect('.played-cards-top'))
      };
    });
    expect(mobileOpenHandGeometry.panel.left).toBeGreaterThanOrEqual(0);
    expect(mobileOpenHandGeometry.panel.right).toBeLessThanOrEqual(mobileOpenHandGeometry.viewport.width);
    expect(mobileOpenHandGeometry.documentWidth).toBeLessThanOrEqual(mobileOpenHandGeometry.viewport.width + 1);
    expect(mobileOpenHandGeometry.scrollX).toBe(0);
    expect(mobileOpenHandGeometry.overlapsScore).toBe(false);
    expect(mobileOpenHandGeometry.overlapsRules).toBe(false);
    expect(mobileOpenHandGeometry.overlapsBottomPlayer).toBe(false);
    expect(mobileOpenHandGeometry.overlapsTopPlay).toBe(false);
    mobileOpenHandGeometry.cards.forEach(card => {
      expect(card.left).toBeGreaterThanOrEqual(mobileOpenHandGeometry.panel.left - 1);
      expect(card.right).toBeLessThanOrEqual(mobileOpenHandGeometry.panel.right + 1);
      expect(card.top).toBeGreaterThanOrEqual(mobileOpenHandGeometry.panel.top - 1);
      expect(card.bottom).toBeLessThanOrEqual(mobileOpenHandGeometry.panel.bottom + 1);
    });
    await dealerPage.screenshot({ path: testInfo.outputPath('perfect-strategy-mobile-landscape.png') });
    await dealerPage.setViewportSize({ width: 1600, height: 1000 });
    await expect(dealerOpenHand).toContainText(`${openPlayerName} · 明牌`);

    await expect(openPlayerPage.locator('.open-hand-panel')).toHaveCount(0);
    await expect(openPlayerPage.locator('.open-hand-self-status')).toContainText('由');
    await expect(openPlayerPage.locator('.my-hand .card.disabled')).toHaveCount(25);

    // 同时覆盖常见笔记本视口，避免侧边明牌在较窄牌桌上重新压住玩家框。
    await firstAttackerPage.setViewportSize({ width: 1366, height: 768 });
    const sideCases = [
      [firstAttackerPage, 'right'],
      [secondAttackerPage, 'left']
    ];
    for (const [attackerPage, position] of sideCases) {
      const panel = attackerPage.locator(`[data-open-hand-position="${position}"]`);
      await expect(panel).toBeVisible();
      await expect(panel.locator('.card.micro')).toHaveCount(25);
      await expect(panel.locator('.open-hand-group')).toHaveCount(await panel.locator('.open-hand-group').count());
      expect(await panel.locator('.open-hand-group').count()).toBeGreaterThanOrEqual(3);

      const cardBoxes = await panel.locator('.open-hand-mini-card').evaluateAll((cards) => cards.map((card) => {
        const rect = card.getBoundingClientRect();
        return { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom };
      }));
      expect(cardBoxes).toHaveLength(25);
      for (let first = 0; first < cardBoxes.length; first += 1) {
        for (let second = first + 1; second < cardBoxes.length; second += 1) {
          const a = cardBoxes[first];
          const b = cardBoxes[second];
          const separated = a.right <= b.left || b.right <= a.left || a.bottom <= b.top || b.bottom <= a.top;
          expect(separated).toBe(true);
        }
      }

      const [panelBox, playerBox, playedBox, tableBox] = await Promise.all([
        panel.boundingBox(),
        attackerPage.locator(`.player-${position}`).boundingBox(),
        attackerPage.locator(`.played-cards-${position}`).boundingBox(),
        attackerPage.locator('.game-table').boundingBox()
      ]);
      cardBoxes.forEach((cardBox) => {
        expect(cardBox.left).toBeGreaterThanOrEqual(panelBox.x);
        expect(cardBox.right).toBeLessThanOrEqual(panelBox.x + panelBox.width);
        expect(cardBox.top).toBeGreaterThanOrEqual(panelBox.y);
        expect(cardBox.bottom).toBeLessThanOrEqual(panelBox.y + panelBox.height);
      });
      expect(panelBox.x).toBeGreaterThanOrEqual(tableBox.x);
      expect(panelBox.x + panelBox.width).toBeLessThanOrEqual(tableBox.x + tableBox.width);
      if (position === 'left') {
        expect(panelBox.x).toBeGreaterThanOrEqual(playerBox.x + playerBox.width - 1);
        expect(playedBox.x).toBeGreaterThanOrEqual(panelBox.x + panelBox.width - 1);
      } else {
        expect(panelBox.x).toBeGreaterThanOrEqual(playedBox.x + playedBox.width - 1);
        expect(playerBox.x).toBeGreaterThanOrEqual(panelBox.x + panelBox.width - 1);
      }
    }

    await firstAttackerPage.setViewportSize({ width: 667, height: 375 });
    const mobileSideOpenHandGeometry = await firstAttackerPage.evaluate(() => {
      const rect = selector => {
        const element = document.querySelector(selector);
        if (!element) return null;
        const box = element.getBoundingClientRect();
        return { top: box.top, right: box.right, bottom: box.bottom, left: box.left };
      };
      const overlaps = (first, second) => Boolean(
        first && second
        && first.left < second.right
        && first.right > second.left
        && first.top < second.bottom
        && first.bottom > second.top
      );
      const panel = rect('[data-open-hand-position="right"]');
      return {
        panel,
        table: rect('.game-table'),
        viewport: { width: window.innerWidth, height: window.innerHeight },
        documentWidth: document.documentElement.scrollWidth,
        scrollX: window.scrollX,
        overlapsScore: overlaps(panel, rect('.score-panel')),
        overlapsRules: overlaps(panel, rect('.center-content.table-tools')),
        overlapsPlayer: overlaps(panel, rect('.player-right')),
        overlapsPlayedCards: overlaps(panel, rect('.played-cards-right')),
        overlapsBottomPlayer: overlaps(panel, rect('.player-bottom'))
      };
    });
    expect(mobileSideOpenHandGeometry.panel.left).toBeGreaterThanOrEqual(mobileSideOpenHandGeometry.table.left);
    expect(mobileSideOpenHandGeometry.panel.right).toBeLessThanOrEqual(mobileSideOpenHandGeometry.table.right);
    expect(mobileSideOpenHandGeometry.panel.top).toBeGreaterThanOrEqual(mobileSideOpenHandGeometry.table.top);
    expect(mobileSideOpenHandGeometry.panel.bottom).toBeLessThanOrEqual(mobileSideOpenHandGeometry.table.bottom);
    expect(mobileSideOpenHandGeometry.documentWidth).toBeLessThanOrEqual(mobileSideOpenHandGeometry.viewport.width + 1);
    expect(mobileSideOpenHandGeometry.scrollX).toBe(0);
    expect(mobileSideOpenHandGeometry.overlapsScore).toBe(false);
    expect(mobileSideOpenHandGeometry.overlapsRules).toBe(false);
    expect(mobileSideOpenHandGeometry.overlapsPlayer).toBe(false);
    expect(mobileSideOpenHandGeometry.overlapsPlayedCards).toBe(false);
    expect(mobileSideOpenHandGeometry.overlapsBottomPlayer).toBe(false);
    await firstAttackerPage.screenshot({ path: testInfo.outputPath('perfect-strategy-side-mobile-landscape.png') });
    await firstAttackerPage.setViewportSize({ width: 1366, height: 768 });

    await dealerPage.locator('.game-table').screenshot({
      path: testInfo.outputPath('perfect-strategy-dealer-view.png')
    });
    await firstAttackerPage.locator('.game-table').screenshot({
      path: testInfo.outputPath('perfect-strategy-side-view.png')
    });

    await expect(dealerPage.locator('.player-bottom.current-turn')).toBeVisible();
    await dealerPage.locator('.my-hand .card').first().dispatchEvent('click');
    await dealerPage.getByRole('button', { name: '出牌(1)' }).click();

    await expect(firstAttackerPage.locator('.player-bottom.current-turn')).toBeVisible();
    const firstAttackerPlayButton = firstAttackerPage.getByRole('button', { name: /^出牌\(\d+\)$/ });
    if (await firstAttackerPage.locator('.my-hand .card.selected').count() === 0) {
      await selectLegalCard(firstAttackerPage.locator('.my-hand .card'), firstAttackerPlayButton);
    }
    await expect(firstAttackerPlayButton).toBeEnabled();
    await firstAttackerPlayButton.click();

    await expect(dealerOpenHand).toHaveClass(/is-interactive/);
    await expect(dealerOpenHand.getByText('由你代打', { exact: true })).toBeVisible();
    await expect(dealerPage.locator('.my-hand .card.disabled')).toHaveCount(24);
    await expect(openPlayerPage.getByRole('button', { name: '出牌(0)' })).toBeDisabled();
    const proxyPlayButton = dealerPage.getByRole('button', { name: /^出牌\(\d+\)$/ });
    if (await dealerOpenHand.locator('.card.selected').count() === 0) {
      await selectLegalCard(dealerOpenHand.locator('.card'), proxyPlayButton);
    }
    await expect(proxyPlayButton).toBeEnabled();
    await proxyPlayButton.click();

    await expect(dealerOpenHand.locator('.card')).toHaveCount(24);
    await expect(openPlayerPage.locator('.my-hand .card')).toHaveCount(24);
    await expect(dealerPage.locator('.played-cards-top .card')).toHaveCount(1);

    const undoButton = dealerPage.getByRole('button', { name: /撤\s*回/ });
    await expect(undoButton).toBeEnabled();
    await undoButton.click();
    await expect(dealerOpenHand.locator('.card')).toHaveCount(25);
    await expect(openPlayerPage.locator('.my-hand .card')).toHaveCount(25);
  } finally {
    await context.close();
  }
});

test('冰山一角由四名玩家自行选牌，打出明牌后由原玩家补选', async ({ browser }, testInfo) => {
  test.setTimeout(120_000);
  const { context, pages } = await openTestModeGame(browser, '冰山一角');

  try {
    await Promise.all(pages.map((playerPage) =>
      expect(playerPage.locator('.open-hand-panel')).toHaveCount(0)
    ));
    const dealerPageIndex = await finishDealerBury(pages);
    const dealerPage = pages[dealerPageIndex];
    const dealerName = `玩家${dealerPageIndex + 1}`;
    await expect(dealerPage.getByRole('button', { name: '查看底牌' })).toBeVisible();

    await Promise.all(pages.map((playerPage) =>
      expect(playerPage.getByRole('button', { name: '确认明牌(0/2)' })).toBeVisible()
    ));
    await Promise.all(pages.map((playerPage) =>
      expect(playerPage.locator('.open-hand-panel')).toHaveCount(0)
    ));

    const chosenIdsByPage = await Promise.all(pages.map(async (playerPage) => {
      const cards = playerPage.locator('.my-hand .card');
      const chosenIds = await Promise.all([
        cards.nth(0).getAttribute('data-card-id'),
        cards.nth(2).getAttribute('data-card-id')
      ]);
      await cards.nth(0).dispatchEvent('click');
      await cards.nth(2).dispatchEvent('click');
      await expect(playerPage.getByRole('button', { name: '确认明牌(2/2)' })).toBeEnabled();
      return chosenIds;
    }));
    await Promise.all(pages.map((playerPage) =>
      playerPage.getByRole('button', { name: '确认明牌(2/2)' }).click()
    ));

    await Promise.all(pages.map(async (playerPage) => {
      await expect(playerPage.locator('.open-hand-panel')).toHaveCount(3);
      await expect(playerPage.locator('.open-hand-panel .card')).toHaveCount(6);
      await expect(playerPage.locator('.open-hand-self-status')).toHaveText('已明置 2 张');
      await expect(playerPage.locator('.my-hand .card-wrapper.is-publicly-revealed')).toHaveCount(2);
    }));

    const dealerInitialRevealedIds = await dealerPage
      .locator('.my-hand .card-wrapper.is-publicly-revealed .card')
      .evaluateAll(cards => cards.map(card => card.dataset.cardId));
    expect(dealerInitialRevealedIds.sort()).toEqual([...chosenIdsByPage[dealerPageIndex]].sort());
    await expect(dealerPage.locator('.public-card-badge')).toHaveCount(0);
    const goldBackground = await dealerPage
      .locator('.my-hand .card-wrapper.is-publicly-revealed .card')
      .first()
      .evaluate(card => getComputedStyle(card).backgroundImage);
    expect(goldBackground).toContain('245, 215, 110');

    const playedRevealedId = dealerInitialRevealedIds[0];
    await dealerPage.locator(`[data-card-id="${playedRevealedId}"]`).dispatchEvent('click');
    await dealerPage.getByRole('button', { name: '出牌(1)' }).click();

    // 从庄家对家的视角验收：长期明牌和本轮出牌各占一条轨道，牌面不能互相覆盖。
    const oppositeObserverPage = pages[(dealerPageIndex + 2) % 4];
    const oppositeRevealedPanel = oppositeObserverPage.locator('[data-open-hand-position="top"]', {
      hasText: `${dealerName} · 冰山`
    });
    const oppositePlayedCards = oppositeObserverPage.locator('.played-cards-top');
    await expect(oppositeRevealedPanel).toBeVisible();
    await expect(oppositePlayedCards.locator('.card')).toHaveCount(1);
    const [revealedPanelBox, playedCardsBox] = await Promise.all([
      oppositeRevealedPanel.boundingBox(),
      oppositePlayedCards.boundingBox()
    ]);
    expect(revealedPanelBox.y + revealedPanelBox.height).toBeLessThanOrEqual(playedCardsBox.y);

    await expect(dealerPage.getByRole('button', { name: '确认明牌(0/1)' })).toBeVisible();
    await expect(dealerPage.locator('.my-hand .card-wrapper.is-publicly-revealed')).toHaveCount(1);
    const observerPage = pages[(dealerPageIndex + 1) % 4];
    await expect(observerPage.getByRole('button', { name: new RegExp(`等待 ${dealerName} 选择明牌`) })).toBeVisible();

    const replacementCard = dealerPage.locator('.my-hand .card-wrapper:not(.is-publicly-revealed) .card').first();
    const replacementCardId = await replacementCard.getAttribute('data-card-id');
    await replacementCard.dispatchEvent('click');
    await dealerPage.getByRole('button', { name: '确认明牌(1/1)' }).click();

    await expect.poll(async () => dealerPage
      .locator('.my-hand .card-wrapper.is-publicly-revealed .card')
      .evaluateAll(cards => cards.map(card => card.dataset.cardId))
    ).toContain(replacementCardId);
    await expect(dealerPage.locator('.my-hand .card-wrapper.is-publicly-revealed')).toHaveCount(2);

    const dealerPanel = observerPage.locator('.open-hand-panel', { hasText: `${dealerName} · 冰山` });
    await expect(dealerPanel.locator('.card')).toHaveCount(2);
    await expect(dealerPanel.locator(`[data-card-id="${playedRevealedId}"]`)).toHaveCount(0);
    await expect(dealerPanel.locator(`[data-card-id="${replacementCardId}"]`)).toHaveCount(1);
    await observerPage.locator('.game-table').screenshot({
      path: testInfo.outputPath('tip-of-iceberg-four-views.png')
    });
  } finally {
    await context.close();
  }
});

test('开局早投降时用四宫格完整公开四家的大量剩余手牌', async ({ browser }, testInfo) => {
  test.setTimeout(120_000);
  const { context, pages } = await openTestModeGame(browser, '世事无常');

  try {
    await Promise.all(pages.map(page => page.setViewportSize({ width: 1440, height: 900 })));
    await finishDealerBury(pages);
    const page = pages[0];

    await page.evaluate(async () => {
      const { useGameStore } = await import('/src/store/gameStore.js');
      const socketService = (await import('/src/services/socket.js')).default;
      const state = useGameStore.getState();
      const roomPlayers = state.currentRoom.players;
      const dealerIndex = state.currentRoom.gameState.dealerPlayerIndex ?? 0;
      const ranks = ['A', 'K', 'Q', 'J', '10', '9', '8', '7', '6', '5', '4', '3', '2'];
      const suits = ['spades', 'hearts', 'clubs', 'diamonds'];
      const revealedHands = roomPlayers.map((player, playerIndex) => ({
        playerId: player.id,
        playerName: player.name,
        seatIndex: playerIndex,
        isDealer: playerIndex === dealerIndex,
        side: playerIndex % 2 === dealerIndex % 2 ? 'dealer' : 'attacker',
        cards: Array.from({ length: 25 }, (_, cardIndex) => {
          if (cardIndex < 2) {
            return {
              id: `showdown-${playerIndex}-joker-${cardIndex}`,
              suit: 'joker',
              rank: cardIndex === 0 ? 'big_joker' : 'small_joker',
              copyIndex: cardIndex
            };
          }
          return {
            id: `showdown-${playerIndex}-${cardIndex}`,
            suit: suits[(cardIndex + playerIndex) % suits.length],
            rank: ranks[(cardIndex * 3 + playerIndex) % ranks.length],
            copyIndex: cardIndex % 2
          };
        })
      }));
      const bottomCards = Array.from({ length: 8 }, (_, index) => ({
        id: `surrender-bottom-${index}`,
        suit: suits[index % suits.length],
        rank: ranks[index],
        copyIndex: index % 2
      }));

      useGameStore.setState({
        currentRoom: {
          ...state.currentRoom,
          gameState: {
            ...state.currentRoom.gameState,
            phase: 'revealing',
            attackerScore: 80
          }
        }
      });
      socketService.socket.listeners('bottom_revealed').forEach(listener => listener({
        bottomCards,
        bottomScoreResult: {
          resultText: '玩家1一方投降，闲家方获胜',
          bottomPoints: 0,
          bottomMultiplier: 0,
          bottomScoreGained: 0,
          totalScore: 80,
          collectedPointCards: [],
          currentGameTrumpSuit: 'hearts',
          currentGameTrumpRank: '2',
          surrender: {
            accepted: true,
            winningSide: 'attacker',
            revealedHands
          }
        },
        upgradeResult: null
      }));
    });

    const showdown = page.locator('[data-testid="surrender-showdown"]');
    const handPanels = showdown.locator('.surrender-showdown-hand');
    await expect(showdown).toBeVisible();
    await expect(showdown).toContainText('共 100 张');
    await expect(handPanels).toHaveCount(4);
    await expect(showdown.locator('.card')).toHaveCount(100);

    const handGeometry = await handPanels.evaluateAll(panels => panels.map(panel => {
      const panelRect = panel.getBoundingClientRect();
      const cards = [...panel.querySelectorAll('.card')].map(card => {
        const rect = card.getBoundingClientRect();
        return { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom };
      });
      return {
        panel: {
          left: panelRect.left,
          top: panelRect.top,
          right: panelRect.right,
          bottom: panelRect.bottom
        },
        cards
      };
    }));
    handGeometry.forEach(({ panel, cards }) => {
      expect(cards).toHaveLength(25);
      cards.forEach(card => {
        expect(card.left).toBeGreaterThanOrEqual(panel.left);
        expect(card.top).toBeGreaterThanOrEqual(panel.top);
        expect(card.right).toBeLessThanOrEqual(panel.right);
        expect(card.bottom).toBeLessThanOrEqual(panel.bottom);
      });
    });

    const [centerBox, settlementBox] = await Promise.all([
      page.locator('.settlement-table-center').boundingBox(),
      page.locator('.settlement-panel.has-surrender-showdown').boundingBox()
    ]);
    expect(settlementBox.x).toBeGreaterThanOrEqual(centerBox.x);
    expect(settlementBox.x + settlementBox.width).toBeLessThanOrEqual(centerBox.x + centerBox.width);
    expect(settlementBox.height).toBeLessThanOrEqual(centerBox.height);

    await page.locator('.game-table').screenshot({
      path: testInfo.outputPath('surrender-showdown-100-cards.png')
    });
  } finally {
    await context.close();
  }
});

test('主视角手牌在发牌与出牌界面都完整落在手牌槽内', async ({ browser }, testInfo) => {
  test.setTimeout(120_000);
  const { context, pages } = await openTestModeGame(browser, '单步调试');

  try {
    // 截图来自高 DPI / 浏览器缩放环境，还要覆盖会命中紧凑高度媒体查询的 CSS 视口。
    await Promise.all(pages.map(page => page.setViewportSize({ width: 1069, height: 694 })));
    const page = pages[0];

    const assertCardsInsideTray = async (stage) => {
      const geometry = await page.locator('.my-hand').evaluate((tray) => {
        const rectOf = element => {
          const rect = element.getBoundingClientRect();
          return {
            top: rect.top,
            right: rect.right,
            bottom: rect.bottom,
            left: rect.left,
            width: rect.width,
            height: rect.height
          };
        };
        return {
          tray: rectOf(tray),
          hand: rectOf(tray.querySelector('.hand')),
          player: rectOf(tray.closest('.player-bottom')),
          table: rectOf(tray.closest('.game-table')),
          cards: [...tray.querySelectorAll('.card')].map(rectOf),
          overflow: getComputedStyle(tray).overflow,
          viewportHeight: window.innerHeight
        };
      });
      expect(geometry.cards.length).toBeGreaterThan(0);
      geometry.cards.forEach((card, index) => {
        expect(
          card.top,
          `${stage}第${index + 1}张牌不得高出手牌槽`
        ).toBeGreaterThanOrEqual(geometry.tray.top);
        expect(
          card.bottom,
          `${stage}第${index + 1}张牌不得低于手牌槽`
        ).toBeLessThanOrEqual(geometry.tray.bottom);
        expect(
          card.bottom,
          `${stage}第${index + 1}张牌不得伸出底部玩家框`
        ).toBeLessThanOrEqual(geometry.player.bottom);
        expect(
          card.bottom,
          `${stage}第${index + 1}张牌不得伸出牌桌`
        ).toBeLessThanOrEqual(Math.min(geometry.table.bottom, geometry.viewportHeight));
      });
      return geometry;
    };

    const drawingGeometry = await assertCardsInsideTray('发牌阶段');
    await page.evaluate(async () => {
      const { useGameStore } = await import('/src/store/gameStore.js');
      const state = useGameStore.getState();
      useGameStore.setState({
        currentRoom: {
          ...state.currentRoom,
          gameState: {
            ...state.currentRoom.gameState,
            phase: 'playing',
            currentPlayerIndex: 0,
            currentTurnPlayerId: state.currentPlayer.id
          }
        }
      });
    });
    await expect(page.getByRole('button', { name: /^\u51fa\u724c/ })).toBeVisible();
    const playingGeometry = await assertCardsInsideTray('出牌阶段');
    expect(playingGeometry.tray.height).toBe(drawingGeometry.tray.height);

    await page.evaluate(async () => {
      const { useGameStore } = await import('/src/store/gameStore.js');
      const socketService = (await import('/src/services/socket.js')).default;
      const state = useGameStore.getState();
      const playedCard = state.myCards[0];
      socketService.socket.listeners('cards_played').forEach(listener => listener({
        playerId: state.currentPlayer.id,
        playerName: state.currentPlayer.name,
        cards: [playedCard],
        removedCardIds: [playedCard.id],
        currentWinningPlayerId: state.currentPlayer.id,
        cardsCount: 1
      }));
    });
    const ownPlayedArea = page.locator('.player-bottom > .played-cards-area.has-cards');
    await expect(ownPlayedArea.locator('.card')).toHaveCount(1);
    const [ownPlayedBox, playerBox, tableBox] = await Promise.all([
      ownPlayedArea.boundingBox(),
      page.locator('.player-bottom').boundingBox(),
      page.locator('.game-table').boundingBox()
    ]);
    expect(ownPlayedBox.y + ownPlayedBox.height).toBeLessThanOrEqual(playerBox.y);
    expect(ownPlayedBox.y).toBeGreaterThanOrEqual(tableBox.y);
    await assertCardsInsideTray('已出牌后');

    await page.locator('.player-bottom').screenshot({
      path: testInfo.outputPath('bottom-hand-contained.png')
    });
  } finally {
    await context.close();
  }
});

test('亮主牌标位于玩家框内且三六九等同时清楚显示主劣', async ({ browser }, testInfo) => {
  test.setTimeout(120_000);
  const { context, pages } = await openTestModeGame(browser, '三六九等');

  try {
    await Promise.all(pages.map(page => page.setViewportSize({ width: 1440, height: 900 })));
    const rightPlayerHeightBefore = await pages[0]
      .locator('.player-right')
      .evaluate(element => element.getBoundingClientRect().height);

    await Promise.all(pages.map(page => page.evaluate(async () => {
      const { useGameStore } = await import('/src/store/gameStore.js');
      const state = useGameStore.getState();
      const declaringPlayer = state.currentRoom.players[1];
      const trumpDeclaration = {
        playerId: declaringPlayer.id,
        playerName: declaringPlayer.name,
        suit: 'spades',
        count: 2,
        declarationType: 'pair',
        declarationRole: 'trump',
        cards: [
          { id: 'trump-badge-spade-2-a', suit: 'spades', rank: '2', copyIndex: 0 },
          { id: 'trump-badge-spade-2-b', suit: 'spades', rank: '2', copyIndex: 1 }
        ]
      };
      const inferiorDeclaration = {
        playerId: declaringPlayer.id,
        playerName: declaringPlayer.name,
        suit: 'clubs',
        count: 2,
        declarationType: 'pair',
        declarationRole: 'inferior',
        cards: [
          { id: 'trump-badge-club-2-a', suit: 'clubs', rank: '2', copyIndex: 0 },
          { id: 'trump-badge-club-2-b', suit: 'clubs', rank: '2', copyIndex: 1 }
        ]
      };
      useGameStore.setState({
        currentRoom: {
          ...state.currentRoom,
          gameState: {
            ...state.currentRoom.gameState,
            trumpSuit: 'spades',
            trumpRank: '2',
            currentTrumpDeclaration: trumpDeclaration,
            currentInferiorDeclaration: inferiorDeclaration,
            threeSixNine: {
              ...(state.currentRoom.gameState.threeSixNine || {}),
              trumpSuit: 'spades',
              trumpRank: '2',
              inferiorSuit: 'clubs',
              currentTrumpDeclaration: trumpDeclaration,
              currentInferiorDeclaration: inferiorDeclaration
            }
          }
        }
      });
    })));

    // 走一遍真实发牌阶段的亮主事件链：trump_declared 与 trump_updated
    // 不得再各弹一条全局消息遮住顶部玩家的亮牌。
    await pages[3].evaluate(async () => {
      const { useGameStore } = await import('/src/store/gameStore.js');
      const socketService = (await import('/src/services/socket.js')).default;
      const state = useGameStore.getState();
      const declaringPlayer = state.currentRoom.players[1];
      useGameStore.setState({
        currentRoom: {
          ...state.currentRoom,
          gameState: {
            ...state.currentRoom.gameState,
            phase: 'drawing'
          }
        }
      });
      const declarationPayload = {
        playerId: declaringPlayer.id,
        playerName: declaringPlayer.name,
        suit: 'spades',
        count: 2,
        declarationType: 'pair',
        strength: 2,
        isCounter: false,
        declarationRole: 'trump',
        cards: [
          { id: 'drawing-trump-spade-a', suit: 'spades', rank: '2', copyIndex: 0 },
          { id: 'drawing-trump-spade-b', suit: 'spades', rank: '2', copyIndex: 1 }
        ]
      };
      socketService.socket.listeners('trump_declared').forEach(listener => listener(declarationPayload));
      socketService.socket.listeners('trump_updated').forEach(listener => listener({
        trumpSuit: 'spades',
        trumpRank: '2',
        inferiorSuit: 'clubs'
      }));
    });
    await pages[3].waitForTimeout(350);
    await expect(pages[3].locator('.ant-message').getByText(/\u4eae主|\u4e3b牌已设置/)).toHaveCount(0);

    const rightSidecar = pages[0].locator('.declaration-sidecar-right');
    await expect(rightSidecar.locator('.declaration-card-slot')).toHaveCount(2);
    await expect(rightSidecar.locator('.declaration-card-slot-label')).toHaveCount(0);
    await expect(rightSidecar.locator('.card')).toHaveCount(4);
    await expect(
      rightSidecar.locator('.declaration-card-slot.is-trump .trump-badge')
    ).toHaveCount(2);
    await expect(
      rightSidecar.locator('.declaration-card-slot.is-inferior .trump-badge')
    ).toHaveCount(2);
    await expect(
      rightSidecar.locator('.declaration-card-slot.is-inferior .inferior-badge:visible')
    ).toHaveCount(0);
    await expect(
      rightSidecar.locator('.card-corner.top-left .card-suit:visible')
    ).toHaveCount(0);
    await expect(
      rightSidecar.locator('.card-center .suit-symbol:visible')
    ).toHaveCount(4);
    const rightPlayerHeightAfter = await pages[0]
      .locator('.player-right')
      .evaluate(element => element.getBoundingClientRect().height);
    expect(rightPlayerHeightAfter).toBe(rightPlayerHeightBefore);
    expect(rightPlayerHeightAfter).toBeGreaterThanOrEqual(108);

    const [rightIdentityBox, rightDeclarationCardBoxes] = await Promise.all([
      pages[0].locator('.player-right > .player-info > div:first-child').boundingBox(),
      rightSidecar.locator('.declaration-card-slot .card').evaluateAll(cards => cards.map(card => {
        const rect = card.getBoundingClientRect();
        return { top: rect.top, bottom: rect.bottom };
      }))
    ]);
    expect(Math.min(...rightDeclarationCardBoxes.map(box => box.top))).toBeGreaterThanOrEqual(
      rightIdentityBox.y + rightIdentityBox.height + 8
    );

    const leftSidecar = pages[2].locator('.declaration-sidecar-left');
    const topSidecar = pages[3].locator('.declaration-sidecar-top');
    const bottomDock = pages[1].locator('.bottom-declaration-dock');
    await expect(leftSidecar.locator('.declaration-card-slot')).toHaveCount(2);
    await expect(topSidecar.locator('.declaration-card-slot')).toHaveCount(2);
    await expect(bottomDock.locator('.declaration-card-slot')).toHaveCount(2);
    const [bottomTrumpDockBox, bottomInferiorDockBox, bottomHandBox] = await Promise.all([
      pages[1].locator('.bottom-declaration-dock.is-trump').boundingBox(),
      pages[1].locator('.bottom-declaration-dock.is-inferior').boundingBox(),
      pages[1].locator('.my-hand').boundingBox()
    ]);
    expect(bottomTrumpDockBox.x).toBeLessThan(bottomInferiorDockBox.x);
    expect(bottomTrumpDockBox.x + bottomTrumpDockBox.width).toBeLessThanOrEqual(bottomHandBox.x);
    expect(bottomInferiorDockBox.x).toBeGreaterThanOrEqual(bottomHandBox.x + bottomHandBox.width);

    const [topPlayerBox, topSidecarBox, topCountBox] = await Promise.all([
      pages[3].locator('.player-top').boundingBox(),
      topSidecar.boundingBox(),
      pages[3].locator('.player-top .player-hand-count').boundingBox()
    ]);
    expect(topSidecarBox.x).toBeGreaterThanOrEqual(topPlayerBox.x);
    expect(topSidecarBox.y).toBeGreaterThanOrEqual(topPlayerBox.y);
    expect(topSidecarBox.x + topSidecarBox.width).toBeLessThanOrEqual(topPlayerBox.x + topPlayerBox.width);
    expect(topSidecarBox.y + topSidecarBox.height).toBeLessThanOrEqual(topPlayerBox.y + topPlayerBox.height);
    expect(topCountBox.y).toBeLessThan(topPlayerBox.y);
    expect(topCountBox.y + topCountBox.height).toBeGreaterThan(topPlayerBox.y);

    const [trumpSlotBox, inferiorSlotBox] = await Promise.all([
      rightSidecar.locator('.declaration-card-slot.is-trump').boundingBox(),
      rightSidecar.locator('.declaration-card-slot.is-inferior').boundingBox()
    ]);
    expect(trumpSlotBox.x).toBeLessThan(inferiorSlotBox.x);
    const cardPairs = await rightSidecar.locator('.declaration-card-pair').evaluateAll(pairs => (
      pairs.map(pair => [...pair.querySelectorAll('.card')].map(card => {
        const rect = card.getBoundingClientRect();
        return { left: rect.left, right: rect.right };
      }))
    ));
    cardPairs.forEach(cards => {
      expect(cards).toHaveLength(2);
      const overlap = cards[0].right - cards[1].left;
      expect(overlap).toBeGreaterThanOrEqual(4);
      expect(overlap).toBeLessThanOrEqual(8);
    });

    const [spadeColor, clubColor] = await Promise.all([
      rightSidecar.locator('.card-suit-spades .suit-symbol').first().evaluate(element => getComputedStyle(element).color),
      rightSidecar.locator('.card-suit-clubs .suit-symbol').first().evaluate(element => getComputedStyle(element).color)
    ]);
    expect(spadeColor).not.toBe(clubColor);

    await pages[0].locator('.game-table').screenshot({
      path: testInfo.outputPath('trump-badge-right-dual.png')
    });
    await pages[3].locator('.game-table').screenshot({
      path: testInfo.outputPath('trump-badge-top-dual.png')
    });
    await pages[1].locator('.game-table').screenshot({
      path: testInfo.outputPath('trump-badge-bottom-dual.png')
    });
    await pages[1].locator('.my-hand-container').screenshot({
      path: testInfo.outputPath('trump-badge-bottom-dock.png')
    });
  } finally {
    await context.close();
  }
});

test('互通有无只在每个页面公开自己的对家手牌', async ({ browser }, testInfo) => {
  test.setTimeout(120_000);
  const { context, pages } = await openTestModeGame(browser, '互通有无');

  try {
    await Promise.all(pages.map((playerPage) =>
      expect(playerPage.locator('.open-hand-panel')).toHaveCount(0)
    ));
    const dealerPageIndex = await finishDealerBury(pages);

    for (let viewerIndex = 0; viewerIndex < pages.length; viewerIndex += 1) {
      const teammateIndex = (viewerIndex + 2) % 4;
      const teammateName = `玩家${teammateIndex + 1}`;
      const playerPage = pages[viewerIndex];
      const teammatePanel = playerPage.locator('[data-open-hand-position="top"]');
      await expect(playerPage.locator('.open-hand-panel')).toHaveCount(1);
      await expect(teammatePanel).toContainText(`${teammateName} · 队友手牌`);
      await expect(teammatePanel.locator('.card')).toHaveCount(25);
      await expect(playerPage.locator('[data-open-hand-position="left"], [data-open-hand-position="right"]')).toHaveCount(0);
    }

    const dealerPage = pages[dealerPageIndex];
    await dealerPage.locator('.my-hand .card').first().dispatchEvent('click');
    await dealerPage.getByRole('button', { name: '出牌(1)' }).click();
    const dealerTeammatePage = pages[(dealerPageIndex + 2) % 4];
    await expect(dealerTeammatePage.locator('[data-open-hand-position="top"] .card')).toHaveCount(24);
    await dealerTeammatePage.locator('.game-table').screenshot({
      path: testInfo.outputPath('mutual-visibility-private-view.png')
    });
  } finally {
    await context.close();
  }
});

test('为人坦荡触发前隐藏、触发后展示四家剩余手牌布局', async ({ browser }, testInfo) => {
  test.setTimeout(120_000);
  const { context, pages } = await openTestModeGame(browser, '为人坦荡');

  try {
    await finishDealerBury(pages);
    await Promise.all(pages.map((playerPage) =>
      expect(playerPage.locator('.open-hand-panel')).toHaveCount(0)
    ));

    // 服务端阈值由规则单测覆盖；这里向已注册的真实客户端监听器注入一次触发快照，验收四视角布局。
    await Promise.all(pages.map((playerPage) => playerPage.evaluate(async () => {
      const { useGameStore } = await import('/src/store/gameStore.js');
      const socketService = (await import('/src/services/socket.js')).default;
      const players = useGameStore.getState().currentRoom.players;
      const suits = ['spades', 'hearts', 'clubs', 'diamonds'];
      const ranks = ['A', 'K', 'Q', 'J', '10'];
      const hands = players.map((player, playerIndex) => ({
        playerId: player.id,
        playerName: player.name,
        kind: 'public',
        label: '全员明牌',
        cards: ranks.map((rank, copyIndex) => ({
          id: `${suits[playerIndex]}-${rank}-${copyIndex}`,
          suit: suits[playerIndex],
          rank,
          copyIndex
        }))
      }));
      socketService.socket.listeners('rule_visible_hands_updated').forEach(listener => listener({
        ruleId: 'open_and_honest',
        hands,
        announcement: '为人坦荡：本轮结束，所有玩家同时明置剩余手牌'
      }));
    })));

    await Promise.all(pages.map(async (playerPage) => {
      await expect(playerPage.locator('.open-hand-panel')).toHaveCount(3);
      await expect(playerPage.locator('.open-hand-panel .card')).toHaveCount(15);
      await expect(playerPage.locator('.open-hand-self-status')).toHaveText('全员明牌');
    }));
    await pages[0].locator('.game-table').screenshot({
      path: testInfo.outputPath('open-and-honest-all-hands.png')
    });
  } finally {
    await context.close();
  }
});

test('十面埋伏只让庄家队友暗选，并在首次出现时向全场揭晓', async ({ browser }, testInfo) => {
  test.setTimeout(120_000);
  const { context, pages } = await openTestModeGame(browser, '十面埋伏');

  try {
    const dealerPageIndex = await finishDealerBury(pages);
    const selectorPageIndex = (dealerPageIndex + 2) % 4;
    const selectorPage = pages[selectorPageIndex];
    const selectorDialog = selectorPage.getByRole('dialog', { name: '十面埋伏 · 暗选点数' });

    await expect(selectorDialog).toBeVisible();
    for (let index = 0; index < pages.length; index += 1) {
      if (index !== selectorPageIndex) {
        await expect(pages[index].getByRole('dialog', { name: '十面埋伏 · 暗选点数' })).toHaveCount(0);
      }
    }
    await expect(selectorDialog.locator('.ten-sided-ambush-rank-grid .ant-btn')).toHaveCount(9);
    await expect(selectorDialog.getByRole('button', { name: '请选择伏击点数' })).toHaveCSS('color', 'rgb(255, 255, 255)');
    for (const forbiddenRank of ['2', '5', '10', 'K']) {
      await expect(selectorDialog.getByRole('button', { name: forbiddenRank, exact: true })).toHaveCount(0);
    }
    const selectorModalContent = selectorDialog.locator('.ant-modal-content');
    await expect.poll(async () => (await selectorModalContent.boundingBox())?.width || 0).toBeGreaterThan(420);
    await selectorPage.screenshot({
      path: testInfo.outputPath('ten-sided-ambush-private-selection.png'),
      animations: 'allow'
    });

    await selectorDialog.getByRole('button', { name: '7', exact: true }).click();
    await selectorDialog.getByRole('button', { name: '确认伏击 7' }).click();
    await expect(selectorDialog).toBeHidden();

    const selectorStatus = selectorPage.locator('.ten-sided-ambush-status');
    await expect(selectorStatus.locator('strong')).toHaveText('7');
    await expect(selectorStatus).toContainText('仅你可见');
    for (let index = 0; index < pages.length; index += 1) {
      if (index === selectorPageIndex) continue;
      const hiddenStatus = pages[index].locator('.ten-sided-ambush-status');
      await expect(hiddenStatus.locator('strong')).toHaveCount(0);
      await expect(hiddenStatus.locator('.ten-sided-ambush-hidden-rank')).toHaveText('?');
      await expect(hiddenStatus).toContainText('首次出现时揭晓');
    }

    // 首次出现与计分由服务端规则单测覆盖；这里向真实监听器注入公开事件，验收四视角状态和揭晓动画。
    await Promise.all(pages.map((playerPage) => playerPage.evaluate(async () => {
      const { useGameStore } = await import('/src/store/gameStore.js');
      const socketService = (await import('/src/services/socket.js')).default;
      const state = useGameStore.getState();
      useGameStore.setState({
        currentRoom: {
          ...state.currentRoom,
          gameState: {
            ...state.currentRoom.gameState,
            tenSidedAmbush: {
              ...state.currentRoom.gameState.tenSidedAmbush,
              isSelectionPending: false,
              isRevealed: true,
              rank: '7',
              attackerNetCardCount: 2
            }
          }
        }
      });
      socketService.socket.listeners('ten_sided_ambush_revealed').forEach(listener => listener({
        rank: '7',
        source: 'play',
        playerName: '玩家1'
      }));
    })));

    await expect(pages[0].locator('.ten-sided-ambush-reveal')).toBeVisible();
    await pages[0].waitForTimeout(380);
    await pages[0].screenshot({
      path: testInfo.outputPath('ten-sided-ambush-reveal-animation.png')
    });
    await Promise.all(pages.map(async (playerPage) => {
      await expect(playerPage.locator('.ten-sided-ambush-status strong')).toHaveText('7');
      await expect(playerPage.locator('.ten-sided-ambush-status')).toContainText('已向全场揭晓');
      await expect(playerPage.locator('.ten-sided-ambush-reveal')).toBeVisible();
      await expect(playerPage.locator('.ten-sided-ambush-score-counter')).toContainText('伏击 7');
      await expect(playerPage.locator('.ten-sided-ambush-score-counter')).toContainText('闲家净拿 +2 张');
    }));
    await pages[0].locator('.game-table').screenshot({
      path: testInfo.outputPath('ten-sided-ambush-public-rank.png')
    });

    // 结算布局与揭晓动画分别验收；隐藏测试注入的动画层，避免它遮挡结算截图。
    await pages[0].locator('.ten-sided-ambush-reveal-overlay').evaluate(element => {
      element.style.display = 'none';
    });
    await pages[0].evaluate(async () => {
      const { useGameStore } = await import('/src/store/gameStore.js');
      const socketService = (await import('/src/services/socket.js')).default;
      const state = useGameStore.getState();
      useGameStore.setState({
        currentRoom: {
          ...state.currentRoom,
          gameState: {
            ...state.currentRoom.gameState,
            phase: 'revealing',
            attackerScore: 40,
            tenSidedAmbush: {
              ...state.currentRoom.gameState.tenSidedAmbush,
              attackerNetCardCount: -4
            }
          }
        }
      });
      const bottomCards = ['4', '8', '4', '6', '7', '2', '6', '7'].map((rank, index) => ({
        id: `settlement-${index}`,
        suit: index < 2 ? 'hearts' : index < 5 ? 'clubs' : 'spades',
        rank,
        copyIndex: index
      }));
      socketService.socket.listeners('bottom_revealed').forEach(listener => listener({
        bottomCards,
        bottomScoreResult: {
          attackerWonBottom: false,
          resultText: '庄家守底',
          bottomPoints: 0,
          bottomMultiplier: 2,
          bottomScoreGained: 20,
          ambushRank: '7',
          ambushCardCount: 2,
          ambushScoreDelta: 20,
          totalScore: 40,
          collectedPointCards: []
        },
        upgradeResult: {
          attackerWon: false,
          oldDealerLevel: 3,
          newDealerLevel: 4,
          dealerLevelUp: 1,
          oldAttackerLevel: 2,
          newAttackerLevel: 2,
          attackerLevelUp: 0,
          nextDealerName: '玩家1',
          nextDealerLevel: 4
        }
      }));
    });

    const settlementCenter = pages[0].locator('.settlement-table-center');
    const settlementPanel = pages[0].locator('.settlement-panel');
    const settlementBottomResult = pages[0].locator('.settlement-bottom-result');
    const settlementResult = pages[0].locator('.settlement-upgrade-result');
    await expect(settlementResult).toBeVisible();
    await expect(pages[0].locator('.ten-sided-ambush-score-counter')).toContainText('闲家净拿 -4 张');
    await expect.poll(async () => {
      const centerBox = await settlementCenter.boundingBox();
      const panelBox = await settlementPanel.boundingBox();
      const bottomResultBox = await settlementBottomResult.boundingBox();
      const upgradeResultBox = await settlementResult.boundingBox();
      if (!centerBox || !panelBox || !bottomResultBox || !upgradeResultBox) return false;
      return panelBox.y >= centerBox.y
        && panelBox.y + panelBox.height <= centerBox.y + centerBox.height
        && panelBox.width <= 520
        && bottomResultBox.y + bottomResultBox.height <= upgradeResultBox.y;
    }).toBe(true);
    await pages[0].locator('.game-table').screenshot({
      path: testInfo.outputPath('ten-sided-ambush-settlement.png')
    });
  } finally {
    await context.close();
  }
});

test('三权分立由二三四号位分别暗选，重复点数首次出现后同步公开', async ({ browser }, testInfo) => {
  test.setTimeout(120_000);
  const { context, pages } = await openTestModeGame(browser, '三权分立');

  try {
    const dealerPageIndex = await finishDealerBury(pages);
    const selectorCases = [
      { pageIndex: (dealerPageIndex + 1) % 4, sourceRank: '10' },
      { pageIndex: (dealerPageIndex + 2) % 4, sourceRank: '5' },
      { pageIndex: (dealerPageIndex + 3) % 4, sourceRank: 'K' }
    ];

    await expect(pages[dealerPageIndex].getByRole('dialog', { name: /三权分立/ })).toHaveCount(0);
    await Promise.all(selectorCases.map(async ({ pageIndex, sourceRank }) => {
      const dialog = pages[pageIndex].getByRole('dialog', {
        name: `三权分立 · 重载原${sourceRank}分牌`
      });
      await expect(dialog).toBeVisible();
      await expect(dialog.locator('.ten-sided-ambush-rank-grid .ant-btn')).toHaveCount(12);
      await expect(dialog.getByRole('button', { name: '2', exact: true })).toHaveCount(0);
      for (const allowedRank of ['5', '10', 'K']) {
        await expect(dialog.getByRole('button', { name: allowedRank, exact: true })).toBeVisible();
      }
    }));

    await Promise.all(pages.map(async (playerPage) => {
      const status = playerPage.locator('[data-testid="three-powers-status"]');
      await expect(status).toBeVisible();
      await expect(status.locator('.three-powers-slot')).toHaveCount(3);
      await expect(status.locator('.three-powers-slot strong')).toHaveText(['?', '?', '?']);
    }));

    for (const { pageIndex, sourceRank } of selectorCases) {
      const dialog = pages[pageIndex].getByRole('dialog', {
        name: `三权分立 · 重载原${sourceRank}分牌`
      });
      await dialog.getByRole('button', { name: '7', exact: true }).click();
      await dialog.getByRole('button', { name: `确认用 7 重载原${sourceRank}分牌` }).click();
      await expect(dialog).toBeHidden();
      const ownSlot = pages[pageIndex].locator(`.three-powers-slot[data-source-rank="${sourceRank}"]`);
      await expect(ownSlot.locator('strong')).toHaveText('7');
      await expect(ownSlot).toContainText('仅你可见');
    }

    await expect(
      pages[dealerPageIndex].locator('.three-powers-slot strong')
    ).toHaveText(['?', '?', '?']);
    for (const { pageIndex, sourceRank } of selectorCases) {
      const status = pages[pageIndex].locator('[data-testid="three-powers-status"]');
      await expect(status.locator('.three-powers-slot strong')).toHaveText(
        ['5', '10', 'K'].map(rank => rank === sourceRank ? '7' : '?')
      );
    }

    await Promise.all(pages.map((playerPage) => playerPage.evaluate(async () => {
      const { useGameStore } = await import('/src/store/gameStore.js');
      const socketService = (await import('/src/services/socket.js')).default;
      const state = useGameStore.getState();
      const slots = state.currentRoom.gameState.threePowers.slots.map(slot => ({
        ...slot,
        isSelected: true,
        isRevealed: true,
        rank: '7'
      }));
      useGameStore.setState({
        currentRoom: {
          ...state.currentRoom,
          gameState: {
            ...state.currentRoom.gameState,
            threePowers: {
              ...state.currentRoom.gameState.threePowers,
              isSelectionPending: false,
              pendingPlayerIds: [],
              slots
            }
          }
        }
      });
      socketService.socket.listeners('three_powers_revealed').forEach(listener => listener({
        slots: slots.map(slot => ({
          sourceRank: slot.sourceRank,
          pointValue: slot.pointValue,
          rank: slot.rank
        })),
        source: 'play',
        playerName: '玩家1'
      }));
    })));

    await Promise.all(pages.map(async (playerPage) => {
      const status = playerPage.locator('[data-testid="three-powers-status"]');
      await expect(status.locator('.three-powers-slot strong')).toHaveText(['7', '7', '7']);
      await expect(status.locator('.three-powers-slot.is-revealed')).toHaveCount(3);
      await expect(playerPage.locator('.three-powers-reveal')).toBeVisible();
    }));

    // 一张重载后的7应实时显示25分；同时打出的原K若未被选择则不再贡献固定10分。
    await Promise.all(pages.map((playerPage) => playerPage.evaluate(async () => {
      const { useGameStore } = await import('/src/store/gameStore.js');
      const socketService = (await import('/src/services/socket.js')).default;
      const player = useGameStore.getState().currentRoom.players[0];
      socketService.socket.listeners('cards_played').forEach(listener => listener({
        playerId: player.id,
        playerName: player.name,
        cards: [
          { id: 'three-powers-live-7', suit: 'clubs', rank: '7', copyIndex: 90 },
          { id: 'three-powers-live-k', suit: 'clubs', rank: 'K', copyIndex: 91 }
        ],
        cardsCount: 2,
        currentWinningPlayerId: player.id
      }));
    })));
    await Promise.all(pages.map(async (playerPage) => {
      await expect(playerPage.locator('.round-points-value')).toHaveText('25');
    }));

    await pages[0].waitForTimeout(380);
    await pages[0].screenshot({
      path: testInfo.outputPath('three-powers-public-reveal.png')
    });
  } finally {
    await context.close();
  }
});

test('Joker 保持竖直且没有冗余标记', async ({ page }, testInfo) => {
  await page.goto('/test/fixtures/joker-preview.html');
  const jokers = page.locator('[data-testid="joker-preview"] .joker-card');
  await expect(jokers).toHaveCount(2);

  for (const joker of await jokers.all()) {
    await expect(joker.locator('.joker-emblem')).toHaveCount(0);
    await expect(joker.locator('.trump-badge')).toHaveCount(1);
    await expect(joker.locator('.trump-badge .trump-star')).toHaveText('★');
    await expect(joker.locator('.card-corner')).toHaveCount(2);
    await expect(joker.locator('.card-corner .card-rank')).toHaveText(['♛', '♛']);
    await expect(joker.locator('.card-corner .card-suit')).toHaveCount(0);

    const letterLayout = await joker.locator('.joker-letter').evaluateAll((letters) =>
      letters.map((letter) => {
        const rect = letter.getBoundingClientRect();
        return { x: rect.x + rect.width / 2, y: rect.y };
      })
    );
    expect(letterLayout).toHaveLength(5);
    expect(Math.max(...letterLayout.map(({ x }) => x)) - Math.min(...letterLayout.map(({ x }) => x))).toBeLessThan(1);
    expect(letterLayout.map(({ y }) => y)).toEqual([...letterLayout.map(({ y }) => y)].sort((a, b) => a - b));
    expect(await joker.locator('.joker-center').evaluate((element) => getComputedStyle(element).transform)).toBe('none');
  }

  await page.locator('[data-testid="joker-preview"]').screenshot({
    path: testInfo.outputPath('jokers-upright.png')
  });
});

test('相邻玩家八张出牌只展开到点数完整可见并与玩家框留有间隔', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1600, height: 900 });
  await page.goto('/test/fixtures/table-layout-preview.html');

  for (const position of ['left', 'right']) {
    const area = page.locator(`.played-cards-${position}`);
    await expect(area).toBeVisible();
    const areaWidth = await area.evaluate((element) => element.getBoundingClientRect().width);
    expect(areaWidth).toBeGreaterThanOrEqual(280);
    expect(areaWidth).toBeLessThanOrEqual(300);

    const cardXs = await area.locator('.card').evaluateAll((cards) =>
      cards.map((card) => card.getBoundingClientRect().x)
    );
    expect(cardXs).toHaveLength(8);
    const steps = cardXs.slice(1).map((x, index) => x - cardXs[index]);
    expect(Math.min(...steps)).toBeGreaterThanOrEqual(29.5);
    expect(Math.max(...steps)).toBeLessThanOrEqual(31);

    const rankVisibility = await area.locator('.card').evaluateAll((cards) =>
      cards.slice(0, -1).map((card, index) => {
        const rank = card.querySelector('.card-corner.top-left .card-rank');
        return rank.getBoundingClientRect().right <= cards[index + 1].getBoundingClientRect().left + 0.5;
      })
    );
    expect(rankVisibility.every(Boolean)).toBe(true);

    const playerBox = page.locator(`.player-${position}`);
    const [areaRect, playerRect] = await Promise.all([
      area.boundingBox(),
      playerBox.boundingBox()
    ]);
    const gap = position === 'left'
      ? areaRect.x - (playerRect.x + playerRect.width)
      : playerRect.x - (areaRect.x + areaRect.width);
    expect(gap).toBeGreaterThanOrEqual(16);
  }

  const declaredCard = page.locator('.bottom-trump-zone .card');
  const handCard = page.locator('.my-hand .card').first();
  const [declaredBox, handBox] = await Promise.all([
    declaredCard.boundingBox(),
    handCard.boundingBox()
  ]);
  expect(declaredBox.width).toBe(handBox.width);
  expect(declaredBox.height).toBe(handBox.height);

  await page.locator('[data-testid="table-layout-preview"]').screenshot({
    path: testInfo.outputPath('side-plays-compact.png')
  });
});

test('木牛流马与本人亮主区并排显示且不覆盖操作按钮或手牌', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1600, height: 900 });
  await page.goto('/test/fixtures/wooden-ox-layout-preview.html');

  const tray = page.locator('.wooden-ox-card-tray');
  const trumpZone = page.locator('.bottom-trump-zone');
  const controls = page.locator('.inline-controls');
  const hand = page.locator('.my-hand');
  await expect(tray).toBeVisible();
  await expect(trumpZone).toBeVisible();
  await expect(trumpZone.locator('.card')).toHaveCount(2);
  await expect(controls).toBeVisible();
  await expect(hand).toBeVisible();

  const [trayBox, trumpZoneBox, controlsBox, handBox] = await Promise.all([
    tray.boundingBox(),
    trumpZone.boundingBox(),
    controls.boundingBox(),
    hand.boundingBox()
  ]);
  const overlaps = (left, right) => !(
    left.x + left.width <= right.x
    || right.x + right.width <= left.x
    || left.y + left.height <= right.y
    || right.y + right.height <= left.y
  );
  expect(overlaps(trayBox, trumpZoneBox)).toBe(false);
  expect(overlaps(trayBox, controlsBox)).toBe(false);
  expect(overlaps(trayBox, handBox)).toBe(false);
  expect(overlaps(trumpZoneBox, controlsBox)).toBe(false);
  expect(overlaps(trumpZoneBox, handBox)).toBe(false);
  expect(trayBox.x + trayBox.width).toBeLessThanOrEqual(trumpZoneBox.x);
  expect(trumpZoneBox.x + trumpZoneBox.width).toBeLessThanOrEqual(handBox.x);

  await page.locator('[data-testid="wooden-ox-layout-preview"]').screenshot({
    path: testInfo.outputPath('wooden-ox-and-trump-zones.png')
  });
});

test('经久不衰在四个方位显示紧凑的上轮牌力来源且不溢出牌桌', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1600, height: 900 });
  await page.goto('/test/fixtures/enduring-preview.html');

  const tableBox = await page.locator('.game-table').boundingBox();
  for (const position of ['top', 'left', 'right', 'bottom']) {
    const area = page.locator(`.played-cards-${position}`);
    await expect(area).toHaveAttribute('data-enduring-inherited', 'true');
    const ribbon = area.locator('.enduring-inheritance-ribbon');
    await expect(ribbon).toBeVisible();
    await expect(ribbon.locator('.enduring-inheritance-seal')).toHaveText('承');
    await expect(ribbon.locator('.enduring-inheritance-label')).toHaveText('上轮牌力');
    const ribbonBox = await ribbon.boundingBox();
    expect(ribbonBox.width).toBeLessThanOrEqual(218.5);
    expect(ribbonBox.x).toBeGreaterThanOrEqual(tableBox.x);
    expect(ribbonBox.x + ribbonBox.width).toBeLessThanOrEqual(tableBox.x + tableBox.width);
  }

  await expect(page.locator('.played-cards-top .enduring-inheritance-cards .card')).toHaveCount(6);
  await expect(page.locator('.played-cards-top .enduring-inheritance-more')).toHaveText('+2');
  await page.locator('[data-testid="enduring-preview"]').screenshot({
    path: testInfo.outputPath('enduring-inheritance-layout.png')
  });
});
