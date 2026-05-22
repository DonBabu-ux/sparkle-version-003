// models/UserTab.js
// Schema for per‑user custom tabs (e.g., Plus‑created lists)
// Each entry links a user to a tab identifier and optional metadata
// This file uses Sequelize‑style definitions (adjust if using another ORM)

module.exports = (sequelize, DataTypes) => {
  const UserTab = sequelize.define('UserTab', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'user_id',
    },
    tabId: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    label: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    // Optional: list of chat IDs that belong to this custom tab
    chatIds: {
      type: DataTypes.JSON,
      allowNull: true,
      defaultValue: [],
    },
    createdAt: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
    updatedAt: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
  }, {
    tableName: 'user_tabs',
    timestamps: true,
  });

  // Associations – a UserTab belongs to a User (if User model exists)
  UserTab.associate = (models) => {
    UserTab.belongsTo(models.User, { foreignKey: 'userId', as: 'user' });
  };

  return UserTab;
};
