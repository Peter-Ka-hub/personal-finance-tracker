const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

// Keep this marker even if the user later deletes all their categories.
const CategorySeed = sequelize.define('CategorySeed', {
  userId: {
    type: DataTypes.UUID,
    primaryKey: true,
  },
}, {
  timestamps: false,
});

module.exports = CategorySeed;
