SideButtonsManager.addButton({    
    label: 'Cliente BES',
    icon: 'images/checked_32.png',
    sections: ['register', 'transactionRoot', 'transactionEdit','customer', 'customer.edit', 'transactionEditTender', 'transactionReturns', 'transactionEdit'],
    handler: ['$modal', function($modal) {
       
        var modalOptions = {
            backdrop: 'static',
            keyboard: false,
            windowClass: 'full',
            templateUrl:  '/plugins/sample/cayan/cliente/clientebes.html',
            controller: 'ExampleController'
        };

        $modal.open(modalOptions);
    }]
});

ButtonHooksManager.addHandler(['after_posTransactionTenderTransaction'],
    function(NotificationService){
        NotificationService.addAlert('This is a hello world message', 'HELLO WORLD!');
    }
);