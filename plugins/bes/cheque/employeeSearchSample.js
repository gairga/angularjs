SideButtonsManager.addButton({    
    label: 'gaby gaby Search',
    icon: 'images/checked_32.png',
    sections: ['register', 'transactionRoot', 'transactionEdit','customer', 'customer.edit', 'transactionEditTender', 'transactionReturns', 'transactionEdit'],
    handler: ['$modal', function($modal) {
       
        var modalOptions = {
            backdrop: 'static',
            keyboard: false,
            windowClass: 'full',
            templateUrl: ugins/prism-plugins-sample/side-buttons/employee-search-sample.htm',
            controller: 'employeeSearchSampleCtrl'
        };

        $modal.open(modalOptions);
    }]
});
