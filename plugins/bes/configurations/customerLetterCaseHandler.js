var customerLetterCaseHandler = ['ModelEvent', function(ModelEvent){
    var handlerBefore = function($q, customer){
        var deferred = $q.defer();

        function capitalize(str){
            return str.charAt(0).toUpperCase() + str.slice(1);
        }

        //ensure first and last names are Letter Cased 
        customer.first_name = capitalize(customer.first_name);
        customer.last_name = capitalize(customer.last_name);

        //resolve the deferred operation
        deferred.resolve();

        //return the deferred promise
        return deferred.promise;
    };

    var listener = ModelEvent.addListener('customer', ['onBeforeSave', 'onBeforeInsert'], handlerBefore);
}]

ConfigurationManager.addHandler(customerLetterCaseHandler);

