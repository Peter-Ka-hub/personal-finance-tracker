@description('Monthly budget amount in EUR')
param budgetAmountEur int = 25

@description('Email address for budget alerts')
param alertEmail string

var budgetName = 'budget-finance-tracker-monthly'

resource budget 'Microsoft.Consumption/budgets@2023-05-01' = {
  name: budgetName
  properties: {
    category: 'Cost'
    amount: budgetAmountEur
    timeGrain: 'Monthly'
    timePeriod: {
      startDate: '2025-01-01'
    }
    notifications: {
      actual80Percent: {
        enabled: true
        operator: 'GreaterThan'
        threshold: 80
        contactEmails: [alertEmail]
        thresholdType: 'Actual'
      }
      actual100Percent: {
        enabled: true
        operator: 'GreaterThan'
        threshold: 100
        contactEmails: [alertEmail]
        thresholdType: 'Actual'
      }
    }
  }
}
