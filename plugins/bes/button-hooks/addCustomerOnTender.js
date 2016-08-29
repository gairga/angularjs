ButtonHooksManager.addHandler(['before_posTransactionTenderTransaction'],
    function($q, DocumentPersistedData, NotificationService, $modal, Templates, ModelService) {
        var deferred = $q.defer(), 
        //retrieve the active document from the cache
        activeDocument = ModelService.fromCache('Document')[0], 
        hasSaleItems, 
        hasOrderItems, 
        hasCustomer;
       
        //filter sales items
        hasSaleItems = activeDocument.items.filter(function(item){
            return item.item_type === 1;
        }).length > 0;

        //filter order items
        hasOrderItems = activeDocument.items.filter(function(item){
            return item.item_type === 3;
        }).length > 0;

        //document has a customer
        hasCustomer = activeDocument.bt_cuid.length;

        //if document does not have a customer or order items and has sale items
        if(!hasCustomer && !hasOrderItems && hasSaleItems){
          
          //diplay confimation window 
          var confirm = NotificationService.addConfirm('Would you like to add a customer before tendering this transation?', 'Add Customer');

          //resolve the result of the confirmation
          confirm.then(function(confirmation){
            if(confirmation){
                //user chose to add a customer
                //reject promise
                deferred.reject();
            }
            else{
                //user chose not to add a customer
                //resolve the promise
                deferred.resolve();
            }
          });
          
        }else{
          //no need to prompt to add a customer
          //resolve the promise;
          deferred.resolve();
        }
        
        return deferred.promise;
    }
);


