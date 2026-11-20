const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

const PendingCategorySeed = sequelize.define('PendingCategorySeed', {
  userId: {
    type: DataTypes.UUID,
    primaryKey: true,
  },
}, {
  timestamps: false,
});

module.exports = PendingCategorySeed;
