var varExampleController = ['$scope', '$http', 'ModelService', 'ModelEvent','CreditCardTypes', function ($scope, $http, ModelService,
 ModelEvent,CreditCardTypes) {

          //Para las tarjetas de Credito 
          //$scope.names = CreditCardTypes.mwCardTypes();
         // $scope.names = CreditCardTypes.getPrismCardTypes(); //Obtiene una lista de todas las tarjetas de Credito
        //   $scope.tipos = CreditCardTypes.mwPrintName();
          $scope.resetBanco = function(){
               //create an empty customer
               $scope.banco = ModelService.create('Creditcardtype');
          }


          $scope.insertBanco = function () {     

            var banco = ModelService.create('Creditcardtype');
            $scope.banco.insert()
          // banco.first_name = 'first_name';
          //7 banco.insert()
               .then(function(){
                   alert('Banco Inserto!');
               },
               function(){
                   alert('Banco Fallo!');
               });
           };

           $scope.loggedin = false;
 
           if(!$http.defaults.headers.common['Auth-Session'] && sessionStorage.getItem('PRISMAUTH')){
               $http.defaults.headers.common['Auth-Session']= sessionStorage.getItem('PRISMAUTH');
               $scope.loggedin = true;
           }
 
 
           $scope.reset = function(){
               //create an empty customer
               $scope.customer = ModelService.create('Customer');
           }
 
           $scope.insertCustomer = function () {
               $scope.customer.insert()
                   .then(function(){
                       alert('Customer inserted!');
                   }, function(){
                       alert('Customer insert failed!');
                   });
           };
 
           $scope.addBeforeListener = function(){
               var handlerBefore = function($q, customer){
                   var d = $q.defer();
                   console.log('Customer Begin Save');
 
                   //change the first_name of the customer before it is saved
                   customer.first_name = 'Joe';
 
                   d.resolve();
                   return d.promise;
               };
 
               ModelEvent.addListener('customer', 'onBeforeInsert', handlerBefore);
           };
 
           $scope.reset();
       }
];

window.angular.module('prismPluginsSample.controller.ExampleController', ['example.dependecies'])
    .controller('ExampleController', varExampleController);