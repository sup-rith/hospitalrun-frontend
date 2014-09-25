import DateSort from 'hospitalrun/utils/date-sort';
export default Ember.ArrayController.extend({
    needs: ['inventory'],
    effectiveDate: null,
    inventoryItems: Ember.computed.alias('controllers.inventory.model'),
    reportColumns: {
        date: {
            label: 'Date',
            include: true,
            property: 'date'
        },
        id: {
            label: 'Id',
            include: true,
            property: 'inventoryItem.friendlyId'
        }, 
        name: {
            label: 'Name',
            include: true,
            property: 'inventoryItem.name'
        }, 
        description: {
            label: 'Description',
            include: false,
            property: 'inventoryItem.description'
        },
        type: {        
            label: 'Type',
            include: true,
            property: 'inventoryItem.type'
        }, 
        xref: {
            label: 'Cross Reference',
            include: false,
            property: 'inventoryItem.crossReference'
        }, 
        reorder: {
            label: 'Reorder Point',
            include: false,
            property: 'inventoryItem.reorderPoint'
        }, 
        price: {
            label: 'Price Per Unit',
            include: false,
            property: 'inventoryItem.price'
        }, 
        quantity: {
            label: 'Quantity', 
            include: true,
            property: 'quantity'
        },
        unit: {
            label: 'Distribution Unit', 
            include: true,
            property: 'inventoryItem.distributionUnit'
        },        
        unitcost: {
            label: 'Unit Cost',
            include: true,
            property: 'unitCost'
        },
        total: {
            label: 'Total Cost',
            include: true,
            property: 'totalCost'
        },         
        gift: {
            label: 'Gift In Kind',
            include: true,
            property: 'giftInKind'
        },
        locations: {
            label: 'Locations',
            include: true,
            property: 'locations'
        }
    },
    reportRows: [],
    reportTitle: null,
    reportType: null,
    reportTypes: [{
        name: 'Detailed Stock Usage',
        value: 'detailedUsage'
    }, {
        name: 'Summary Stock Usage',
        value: 'summaryUsage'
    }, {
        name: 'Detailed Purchase',
        value: 'detailedPurchase'
    }, {
        name: 'Summary Purchase',
        value: 'summaryPurchase'
    }, {
        name: 'Detailed Stock Transfer',
        value: 'detailedTransfer'
    }, {
        name: 'Summary Stock Transfer',
        value: 'summaryTransfer'
    }, {        
        name: 'Expiration Date',
        value: 'expiration'
    }, {
        name: 'Inventory Valuation',
        value: 'valuation'
    }],

    includeDate: function() {
        var reportType = this.get('reportType');
        if (reportType.indexOf('detailed') ===0) {
            this.set('reportColumns.date.include', true);                     
            return true;
        } else {
            this.set('reportColumns.date.include', false);
            return false;
        }
        
    }.property('reportType'),
    
    includeCostFields: function() {
        var reportType = this.get('reportType');
        if (reportType === 'detailedTransfer' || reportType === 'summaryTransfer') {
            this.set('reportColumns.total.include', false);
            this.set('reportColumns.unitcost.include', false);
            return false;
        } else {
            this.set('reportColumns.total.include', true);
            this.set('reportColumns.unitcost.include', true);            
            return true;
        }
    }.property('reportType'),

    isValuationReport: function() {
        var reportType = this.get('reportType');
        return (reportType === 'valuation');        
    }.property('reportType'),
    
    showReportResults: false,
    
    useFieldPicker: function() {
        var reportType = this.get('reportType');
        return (reportType !== 'expiration');
    }.property('reportType'),
    
    _addReportRow: function(row) {
        var columnValue,
            locations, 
            locationDetails = '',
            reportColumns = this.get('reportColumns'),
            reportRows = this.get('reportRows'),
            reportRow = [];
        for (var column in reportColumns) {
            if (reportColumns[column].include) {
                columnValue = Ember.get(row,reportColumns[column].property);
                if (Ember.isEmpty(columnValue)) {
                     reportRow.push('');
                } else if (reportColumns[column].property === 'locations') {
                    locations = columnValue;
                    for (var i=0; i< locations.length; i++) {                        
                        if (i > 0) {
                            locationDetails += '; ';
                        }
                        if (!Ember.isEmpty(locations[i].quantity)) {
                            locationDetails += '%@ (%@ available)'.fmt(locations[i].name, locations[i].quantity);
                        } else {
                            locationDetails += locations[i].name;
                        }
                    }
                    reportRow.push(locationDetails);
                } else {
                    reportRow.push(columnValue);
                }
            }
        }
        reportRows.addObject(reportRow);
    },
    
    _addTotalsRow: function(summaryCost, summaryQuantity) {
        if (summaryQuantity > 0) {
            this._addReportRow({
                totalCost: 'Total: '+summaryCost.toFixed(2),
                quantity: 'Total: '+summaryQuantity,
                unitCost: 'Total: '+(summaryCost/summaryQuantity).toFixed(2)
            });
        }        
    },
    
    /**
     * Adjust the specified location by the specified quantity
     * @param {array} locations the list of locations to adjust from
     * @param {string} locationName the name of the location to adjust
     * @param {integer} quantity the quantity to adjust.
     * @param {boolean} increment boolean indicating if the adjustment is an increment; or false if decrement.
     */
    _adjustLocation: function(locations, locationName, quantity, increment) {
        var locationToUpdate = locations.findBy('name', locationName);
        if (Ember.isEmpty(locationToUpdate)) {
            locationToUpdate = {
                name: locationName,
                quantity: 0
            };
            locations.push(locationToUpdate);
        }
        if (increment) {
            locationToUpdate.quantity += quantity;
        } else {
            locationToUpdate.quantity -= quantity;
        }
    },
    
    /**
     * Adjust the specified purchase by the specified quantity.
     * @param {array} purchases the list of purchases to adjust from.
     * @param {string} purchaseId the id of the purchase to adjust.
     * @param {integer} quantity the quantity to adjust.
     * @param {boolean} increment boolean indicating if the adjustment is an increment; or false if decrement.
     */
    _adjustPurchase: function(purchases, purchaseId, quantity, increment) {
        var purchaseToAdjust = purchases.findBy('id', purchaseId);
        if (!Ember.isEmpty(purchaseToAdjust)) {
            var calculatedQuantity = purchaseToAdjust.get('calculatedQuantity');
            if (increment) {
                calculatedQuantity += quantity;
            } else {
                calculatedQuantity -= quantity;
            }
            purchaseToAdjust.set('calculatedQuantity',calculatedQuantity);
        }        
    },
    
    /**
     * Filter the records by the specified field and the the specified start and (optional) end dates.
     * @param {Array} records to filter.
     * @param {String} field name of the date field in the record to filter by.
     */
    _filterByDate: function(records, field) {
        var endDate = this.get('endDate'),
            startDate = this.get('startDate');        
        return records.filter(function(record) {
            var compareDate = moment(record.get(field));
            return ((Ember.isEmpty(endDate) || compareDate.isSame(endDate, 'day') || 
                     compareDate.isBefore(endDate, 'day')) &&
                    (Ember.isEmpty(startDate) || compareDate.isSame(startDate, 'day') || compareDate.isAfter(startDate, 'day')));
        });
    },
    
    _generateExpirationReport: function() {
        var inventoryItems = this.get('inventoryItems'),            
            reportRows = this.get('reportRows');
        inventoryItems.forEach(function(inventoryItem) {
            var inventoryPurchases = this._filterByDate(inventoryItem.get('purchases'), 'expirationDate');

            inventoryPurchases.forEach(function(purchase) {
                var currentQuantity = purchase.get('currentQuantity'),
                    expirationDate = purchase.get('expirationDate');
                if (currentQuantity > 0 && !Ember.isEmpty('expirationDate')) {
                    reportRows.addObject([
                        inventoryItem.get('friendlyId'),
                        inventoryItem.get('name'),
                        currentQuantity,
                        inventoryItem.get('distributionUnit'),
                        moment(expirationDate).format('l')                        
                    ]);
                }
            }.bind(this));
        }.bind(this));
        this.set('showReportResults', true);
        this.set('reportHeaders', ['Id','Name','Current Quantity','Distribution Unit','Expiration Date']);
        this._generateExport();
        this._setReportTitle();
    },        
    
    _generateExport: function() {
        var csvRows = [],
            reportHeaders = this.get('reportHeaders'),
            dataArray = [reportHeaders];
        dataArray.addObjects(this.get('reportRows'));
        dataArray.forEach(function(row) { 
            csvRows.push(row.join(','));   // unquoted CSV row
        });
        var csvString = csvRows.join('\r\n');
        var uriContent = "data:application/csv;charset=utf-8," + encodeURIComponent(csvString);
        this.set('csvExport', uriContent);
    },
    
    _generateValuationReport: function() {
        var inventoryItems = this.get('inventoryItems'),
            inventoryRequests =  this._filterByDate(this.get('model'), 'dateCompleted'),
            requestPromises = [],
            reportType = this.get('reportType');
        inventoryItems.forEach(function(item) {
            //Clear out requests from last time report was run.
            item.set('requests', []);
        });                
        if (!Ember.isEmpty(inventoryRequests)) {
            //SORT REQUESTS
            inventoryRequests.sort(function(firstRequest, secondRequest) {
                return DateSort.sortByDate(firstRequest, secondRequest, 'dateCompleted');
            }.bind(this));

            //Link inventory requests to inventory items
            inventoryRequests.forEach(function(request) {
                requestPromises.push(new Ember.RSVP.Promise(function(resolve, reject){
                    request.get('inventoryItem').then(function(inventoryItem) {
                        var requestItem = inventoryItems.findBy('id', inventoryItem.get('id'));
                        if (!Ember.isEmpty(requestItem)) {
                            var itemRequests = requestItem.get('requests');
                            itemRequests.push(request);
                            inventoryItem.set('requests', itemRequests);
                        }                        
                        resolve();
                    }, reject);
                }));
            });
        }
        Ember.RSVP.all(requestPromises,'All inventory requests matched to inventory items').then(function(){
            //Loop through each itinerary item, looking at the requests and purchases to determine
            //state of inventory at effective date
            inventoryItems.forEach(function(item) {
                var inventoryPurchases = item.get('purchases'),
                    inventoryRequests = item.get('requests'),
                    row = {
                        giftInKind: 'N',
                        inventoryItem: item,
                        quantity: 0,
                        unitCost: 0,
                        totalCost: 0,
                        locations: [
                        ]
                    };

                inventoryPurchases = this._filterByDate(inventoryPurchases, 'dateReceived');
                if (Ember.isEmpty(inventoryPurchases)) {
                    //If there are no purchases applicable then skip this inventory item.
                    return;
                }
                //Setup intial locations for an inventory item
                inventoryPurchases.forEach(function(purchase) {
                    var locationName = purchase.get('locationName'),
                        purchaseQuantity = purchase.get('originalQuantity');
                    purchase.set('calculatedQuantity', purchaseQuantity);
                    if (purchase.get('giftInKind') === true) {
                        row.giftInKind = 'Y';
                    }
                    this._adjustLocation(row.locations, locationName, purchaseQuantity, true);
                }.bind(this));

                if(!Ember.isEmpty(inventoryRequests)) {
                    inventoryRequests.forEach(function(request) {
                        var adjustPurchases = request.get('adjustPurchases'),                                
                            increment = false,
                            locations = request.get('locationsAffected'),
                            purchases = request.get('purchasesAffected'),
                            transactionType = request.get('transactionType');


                        increment = (transactionType === 'Adjustment (Add)');
                        if (adjustPurchases) {
                            if (!Ember.isEmpty(purchases)) {
                                //Loop through purchase(s) on request and adjust corresponding inventory purchases
                                purchases.forEach(function(purchaseInfo) {
                                    this._adjustPurchase(inventoryPurchases, purchaseInfo.id, purchaseInfo.quantity, increment);
                                }.bind(this));
                            }
                        } else if (transactionType === 'Transfer') {
                            //Increment the delivery location
                            var locationName = request.get('deliveryLocationName');
                                if (Ember.isEmpty(locationName)) {
                                    locationName = 'No Location';
                                }
                            this._adjustLocation(row.locations,  locationName, request.get('quantity'), true);
                        }
                        //Loop through locations to adjust location quantity
                        locations.forEach(function(locationInfo){
                            this._adjustLocation(row.locations,  locationInfo.name, locationInfo.quantity, increment);
                        }.bind(this));
                    }.bind(this));
                }

                var summaryCost = 0,
                    summaryQuantity = 0;
                    
                switch(reportType) {
                    case 'detailedTransfer':
                    case 'detailedUsage': {
                        inventoryRequests.forEach(function(request) {
                            if ((reportType === 'detailedTransfer' && request.get('transactionType') === 'Transfer') || 
                                (reportType === 'detailedUsage' && request.get('transactionType') === 'Fulfillment')) {                                
                                var deliveryLocation = request.get('deliveryLocationName'),
                                    locations = [],
                                    totalCost = (request.get('quantity') * request.get('costPerUnit')); 
                                locations = request.get('locationsAffected').map(function(location) {
                                    if (reportType === 'detailedTransfer') {
                                        return {
                                            name: 'From: %@ To: %@'.fmt(location.name, deliveryLocation)
                                        };
                                    } else {
                                        return {
                                            name: '%@ from %@'.fmt(location.quantity, location.name)
                                        };                                        
                                    }
                                });
                                
                                this._addReportRow({
                                    date: moment(request.get('dateCompleted')).format('l'),
                                    giftInKind: row.giftInKind,
                                    inventoryItem: row.inventoryItem,
                                    quantity: request.get('quantity'),
                                    type: request.get('transactionType'),
                                    locations: locations,
                                    unitCost: request.get('costPerUnit'),
                                    totalCost: totalCost.toFixed(2)
                                });
                                summaryQuantity += request.get('quantity');
                                summaryCost += totalCost;
                            }
                        }.bind(this));
                        this._addTotalsRow(summaryCost, summaryQuantity);
                        break;
                    }
                    case 'summaryTransfer':
                    case 'summaryUsage': {
                        row.quantity = inventoryRequests.reduce(function(previousValue, request) {
                            if ((reportType === 'summaryTransfer' && request.get('transactionType') === 'Transfer') || 
                                (reportType === 'summaryUsage' && request.get('transactionType') === 'Fulfillment')) {
                                var totalCost = (request.get('quantity') * request.get('costPerUnit')); 
                                summaryCost += totalCost;
                                return previousValue += request.get('quantity');
                            } else {
                                return previousValue;
                            }
                        }, 0);
                        if (row.quantity > 0) {
                            row.totalCost = summaryCost.toFixed(2);                        
                            row.unitCost = (summaryCost/row.quantity).toFixed(2);
                            this._addReportRow(row);
                        }
                        break;
                    }
                    case 'detailedPurchase': {
                        inventoryPurchases.forEach(function(purchase) {
                            var giftInKind = 'N';
                            if (purchase.get('giftInKind') === true) {
                                giftInKind = 'Y';
                            }
                            this._addReportRow({
                                date: moment(purchase.get('dateReceived')).format('l'),
                                giftInKind: giftInKind,
                                inventoryItem: row.inventoryItem,
                                quantity: purchase.get('originalQuantity'),
                                unitCost: purchase.get('costPerUnit'),
                                totalCost: purchase.get('purchaseCost'),
                                locations: [{
                                    name: purchase.get('locationName')                                
                                }]
                            });
                            summaryCost += purchase.get('purchaseCost');
                            summaryQuantity += purchase.get('originalQuantity');
                        }.bind(this));
                        this._addTotalsRow(summaryCost, summaryQuantity);                        
                        break;
                    }
                    case 'summaryPurchase': {
                        row.locations = [];
                        row.quantity = inventoryPurchases.reduce(function(previousValue, purchase) {                            
                            summaryCost += purchase.get('purchaseCost');
                            row.locations.push({
                                name: purchase.get('locationName')                                
                            });
                            return previousValue += purchase.get('originalQuantity');
                        }, 0);
                        row.unitCost = (summaryCost/row.quantity).toFixed(2);
                        row.totalCost = summaryCost.toFixed(2);
                        
                        this._addReportRow(row);
                        break;
                    }                                        
                    case 'valuation': {
                        //Calculate quantity and cost per unit for the row
                        inventoryPurchases.forEach(function(purchase) {
                            var costPerUnit = purchase.get('costPerUnit'),
                                quantity = purchase.get('calculatedQuantity');                                    
                            row.quantity += purchase.get('calculatedQuantity');
                            row.totalCost += (quantity * costPerUnit);
                        });
                        row.totalCost = row.totalCost.toFixed(2);
                        row.unitCost = (row.totalCost/row.quantity).toFixed(2);
                        this._addReportRow(row);
                        break;                        
                    }
                }
            }.bind(this));
            this._generateExport();
        }.bind(this));
        this.set('showReportResults', true);
        this._setReportHeaders();
        this._setReportTitle();
    },    
        
    _setReportHeaders: function() {
        var reportColumns = this.get('reportColumns'),
            reportHeaders = [];
        for (var column in reportColumns) {
            if (reportColumns[column].include) {
                reportHeaders.push(reportColumns[column].label);
            }
        }
        this.set('reportHeaders', reportHeaders);
    },
    
    _setReportTitle: function() {
        var endDate = this.get('endDate'),
            formattedEndDate = '',
            formattedStartDate = moment(this.get('startDate')).format('l'),
            reportType = this.get('reportType'),
            reportTypes = this.get('reportTypes');
        if (!Ember.isEmpty(endDate)) {
            formattedEndDate = moment(endDate).format('l');
        }
        var reportDesc = reportTypes.findBy('value', reportType);
        this.set('reportTitle', '%@ Report %@ - %@'.fmt(reportDesc.name, formattedStartDate, formattedEndDate));        
    },
    
    actions: {
        generateReport: function() {
            var endDate = this.get('endDate'),
                reportRows = this.get('reportRows'),
                reportType = this.get('reportType'),
                startDate = this.get('startDate');
            if (Ember.isEmpty(startDate) && Ember.isEmpty(endDate)) {
                return;
            }
            reportRows.clear();            
            switch (reportType) {
                case 'expiration': {
                    this._generateExpirationReport();
                    break;                    
                }
                default: {
                    this._generateValuationReport();
                    break;
                }
            }
        }
    },

    
    setup: function() {
        var effectiveDate = this.get('effectiveDate'),
            reportType = this.get('reportType'),
            startDate = this.get('startDate');
        if (Ember.isEmpty(effectiveDate)) {
            this.set('effectiveDate', new Date());
        }
        if (Ember.isEmpty(reportType)) {
            this.set('reportType', 'valuation');
        }
        if (Ember.isEmpty(startDate)) {
            this.set('startDate', new Date());
        }        
    }.on('init')
});