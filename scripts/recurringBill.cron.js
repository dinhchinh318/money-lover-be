const cron = require("node-cron");
const dayjs = require("dayjs");
const RecurringBill = require("../src/models/recurringBill");
const { payRecurringBill } = require("../src/services/recurringBillService");

const startRecurringBillCron = () => {
  // chạy mỗi 5 phút
  cron.schedule("*/5 * * * *", async () => {
    console.log("[CRON] Checking recurring bills...");

    const now = new Date();

    const bills = await RecurringBill.find({
      active: true,
      auto_create_transaction: true,
      next_run: { $lte: now },
    });

    for (const bill of bills) {
      try {
        console.log(`[CRON] Auto paying: ${bill.name}`);
        await payRecurringBill(bill.userId, bill._id);
      } catch (err) {
        console.error(
          `[CRON] Failed bill ${bill._id}:`,
          err.message
        );
      }
    }
  });
};

module.exports = { startRecurringBillCron };
