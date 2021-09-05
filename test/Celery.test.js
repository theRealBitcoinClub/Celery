// test/Celery.test.js
// Load dependencies
const { BigNumber } = require("@ethersproject/bignumber");
const { expect } = require("chai");
const hre = require("hardhat");

var Celery;

const initialSupply = 100000000;

// Start test Celery
describe("Celery", function () {
  before(async function () {
    this.CeleryFactory = await ethers.getContractFactory("Celery");
    this.owner = (await ethers.getSigners())[0];
  });

  beforeEach(async function () {
    Celery = await this.CeleryFactory.deploy(initialSupply);
    await Celery.deployed();
  });

  // Test case
  it("Test if start stake changes account status to staking", async function () {
    // Start Stake
    await Celery.StartStake();

    // Test if account status is staking
    await expectStatus(this.owner.address, 1);
  });

  // Test case
  it("Test if staking amount doubles in a year", async function () {
    await StakeAmountForTime.bind(this)(100000000, 31536000);

    // Test if account staking balance doubled
    await expectStakedAmount(this.owner.address, 200000000);

    // Test if account balance is 0
    await expectAccountBalance(this.owner.address, 0);
  });

  // Test case
  it("Test if payout is half amount in a year", async function () {
    await StakeAmountForTime.bind(this)(100000000, 31536000);

    // Wait half year in block time
    await increaseBlockTime(15768000);

    // Collect Payout for half year
    await Celery.CollectPayout();

    // Test if account status is payuot
    await expectStatus(this.owner.address, 0);

    // Test if account staked balance is halved
    await expectStakedAmount(this.owner.address, initialSupply);

    // Test if payout was added to account balance
    await expectAccountBalance(this.owner.address, 100000000);

    // Test if contract balance is subtracted
    await expectAccountBalance(Celery.address, 0);
  });

  // Test case
  it("Test if contract mints tokens on payout", async function () {
    await StakeAmountForTime.bind(this)(100000000, 63072000);

    // Test if account staked balance is 4x
    await expectStakedAmount(this.owner.address, 400000000);

    // Wait 1 year in block time
    await increaseBlockTime(31536000);

    // Collect Payout
    await Celery.CollectPayout();

    // Test if account balance received all staked tokens
    await expectAccountBalance(this.owner.address, 400000000);

    // Test if token total supply is 5x
    await expectTotalSupply(500000000);
    // Test if contract balance is holding initial stake
    await expectAccountBalance(Celery.address, 100000000);
  });

  // Test case
  it("Test if contract penalizes immediate payout by 50%", async function () {
    await StakeAmountForTime.bind(this)(100000000, 31536000);

    // Test if account staked balance is 2x
    await expectStakedAmount(this.owner.address, 200000000);

    await increaseBlockTime(15768000);

    // Collect Payout
    await Celery.CollectAll();

    // Test if account balance received 50% of staked tokens
    await expectAccountBalance(this.owner.address, 150000000);

    // Test if account staked balance is set back to 0
    await expectStakedAmount(this.owner.address, 0);

    // Test if contract balance is subtracted
    await expectAccountBalance(Celery.address, 0);
  });

  // Test case
  it("Test if contract gives back no more than entire staked amount%", async function () {
    await StakeAmountForTime.bind(this)(100000000, 31536000);

    // Test if account staked balance is 2x
    await expectStakedAmount(this.owner.address, 200000000);

    // Wait many years
    await increaseBlockTime(9931536000);

    // Collect Payout
    await Celery.CollectPayout();

    // Test if account balance received all staked tokens
    await expectAccountBalance(this.owner.address, 200000000);
    // Test if account staked balance is set back to 0
    await expectStakedAmount(this.owner.address, 0);
  });

  // Test case
  it("Test start stake twice", async function () {
    // Collect Payout
    await Celery.StartStake();

    // Collect Payout
    await Celery.StartStake();
  });

  // Test case
  it("Test collecet with nothing staked", async function () {
    // Collect Payout
    await Celery.CollectPayout();
    // Test if account staked balance is set back to 0
    await expectStakedAmount(this.owner.address, 0);

    // Test if account balance received all staked tokens
    await expectAccountBalance(this.owner.address, 100000000);
  });
});

// *** Helper Functions *** //

// Helper function for account staking of time length
async function StakeAmountForTime(amount, time) {
  // Increase Stake
  await Celery.IncreaseStake(amount);

  const timeStaked = await Celery.getLastProcessedTime(this.owner.address);

  // Test if account status is staking
  await expectStatus(this.owner.address, 1);

  // Wait seconds in block time
  await increaseBlockTime(time);

  // Start payout
  await Celery.StartPayout();

  // Test if last processed time is correct
  expectLastProcessedTime(
    this.owner.address,
    BigNumber.from(time).add(timeStaked)
  );

  // Test if account status is payout
  await expectStatus(this.owner.address, 0);

  // Test current payout amount is correct
  const calcStakeAmount = calculateStake(amount, 0, time);
  await expectPayoutAmount(this.owner.address, calcStakeAmount);

  // Test staked amount is correct
  await expectStakedAmount(this.owner.address, calcStakeAmount);
}

function calculateStake(amount, startTime, endTime) {
  const secondsInAYear = 31536000;
  const diffTime = endTime - startTime;
  const percTime = diffTime / secondsInAYear;
  return Math.round(amount * Math.pow(Math.E, percTime * Math.LN2));
}

// *** Expect Functions *** //

async function expectAccountBalance(address, amount) {
  expect((await Celery.balanceOf(address)).toString()).to.equal(
    amount.toString()
  );
}

async function expectStakedAmount(address, amount) {
  expect((await Celery.getStakedAmount(address)).toString()).to.equal(
    amount.toString()
  );
}

async function expectPayoutAmount(address, amount) {
  expect((await Celery.getCurrentPayoutAmount(address)).toString()).to.equal(
    amount.toString()
  );
}

async function expectLastProcessedTime(address, time) {
  expect((await Celery.getLastProcessedTime(address)).toString()).to.equal(
    time.toString()
  );
}

async function expectStatus(address, status) {
  expect((await Celery.getStatus(address)).toString()).to.equal(
    status.toString()
  );
}

async function expectTotalSupply(amount) {
  expect((await Celery.totalSupply()).toString()).to.equal(amount.toString());
}

// Increase block timestamp by number of seconds
async function increaseBlockTime(time) {
  const lastBlockTime = (await ethers.provider.getBlock("latest")).timestamp;
  const nextBlockTime = lastBlockTime + time - 1;
  await hre.network.provider.send("evm_mine", [nextBlockTime]);
}
