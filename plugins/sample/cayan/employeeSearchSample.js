SideButtonsManager.addButton({       
    label: 'Employee Search',
    icon: 'images/checked_32.png',
    sections: ['register', 'transactionRoot', 'transactionEdit'],
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
