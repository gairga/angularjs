SideButtonsManager.addButton({       
    label: 'Formas de Pago',
    icon: 'images/checked_32.png',
    sections: ['register', 'customer', 'customer.edit', 'transactionRoot', 'transactionView', 
    'transactionEdit','transactionReturns', 'transactionEditTender', 'transactionEditTenderMWTenderStatus', 
    'xout','zout', 'zoutopen', 'zoutclose'],
    handler: ['$modal', function($modal) {
       
        var modalOptions = {
            backdrop: 'static',
            keyboard: false,
            windowClass: 'full',
            templateUrl: '/plugins/sample/cayan/bes/cheque/employeeSearchSample.htm',
        //    templateUrl: '/views/default/zout-search-partial.htm.htm',
            controller: 'employeeSearchSampleCtrl'
        };

        $modal.open(modalOptions);
    }]
});


