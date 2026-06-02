@description('Monthly budget amount in EUR')
param budgetAmountEur int = 25

@description('Email address for budget alerts')
param alertEmail string

@description('Budget start date — must be the first of a month, not before the current month')
param budgetStartDate string = utcNow('yyyy-MM-01')

var budgetName = 'budget-finance-tracker-monthly'

resource budget 'Microsoft.Consumption/budgets@2023-05-01' = {
  name: budgetName
  properties: {
    category: 'Cost'
    amount: budgetAmountEur
    timeGrain: 'Monthly'
    timePeriod: {
      startDate: budgetStartDate
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
