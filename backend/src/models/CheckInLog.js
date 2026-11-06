const db = require('../lib/db');
const TABLE = 'check_in_logs';

module.exports = {
  async findOne(opts) {
    return db.findOne(TABLE, opts);
  },
  async findById(id, opts) {
    return db.findById(TABLE, id, opts);
  },
  async find(opts) {
    return db.find(TABLE, opts);
  },
  async create(data) {
    return db.create(TABLE, data);
  },
  async countDocuments(filter) {
    return db.count(TABLE, filter);
  },
};
