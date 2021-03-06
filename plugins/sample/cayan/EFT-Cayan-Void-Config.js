var cayanVoidHandler = ['ModelEvent','eftCayanService','NotificationService',
  function(ModelEvent,eftCayanService, NotificationService){
  var handlerBefore = function($q, tender){
    var deferred = $q.defer();

    // checks to see if transaction was generated by an EFT provider and has a valid ID from the provider
    if(tender.eft_transaction_id.length > 0){
      // Initiate credit transaction in the EFT service created in EFT-Cayan-Service.js
      eftCayanService.Credit.Initiate({
        document_sid: tender.document_sid,
        actiontype: 'VOID_TRANSACTION',
        usegeniusdevice: false,
        forcedupcheck: true,
        token: tender.eft_transaction_id
      }).then(function (voidResult) {
        if (voidResult[0].approvalstatus.toLowerCase() !== 'approved') { // Check if void was approved from provider
          // Generate error if provider did not approve the void
          NotificationService.addAlert(voidResult[0].errormessage, voidResult[0].approvalstatus, true);
          deferred.reject(); // stop Prisms removal process from completing
        } else {
          deferred.resolve(); // continue with Prisms normal removal process
        }
      });
    } else {
    // if it isnt an EFT transaction continue with Prisms normal removal process
     deferred.resolve();
    }
    //return the deferred promise
    return deferred.promise;
  };

  // Add listener to run before the tender is removed
  var listener = ModelEvent.addListener('tender', 'onBeforeRemove', handlerBefore);
}];

ConfigurationManager.addHandler(cayanVoidHandler);
