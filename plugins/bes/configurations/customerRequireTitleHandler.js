
var customerRequireTitleHandler = ['ModelEvent', 'NotificationService', function(ModelEvent, NotificationService){
    var handlerBefore = function($q, customer){
        var deferred = $q.defer();

        if(!customer.title_sid){
            NotificationService.addAlert('You must select a title for the customer.', 'Customer Title Required');
            deferred.reject();
        }
        else{
            deferred.resolve();    
        }
        
        //return the deferred promise
        return deferred.promise;
    };

    var listener = ModelEvent.addListener('customer', ['onBeforeSave', 'onBeforeInsert'], handlerBefore);
}]

ConfigurationManager.addHandler(customerRequireTitleHandler);