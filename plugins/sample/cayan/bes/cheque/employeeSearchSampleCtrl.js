var employeeSearchSample = ['$scope','$http', '$modalInstance', 'ModelService','CreditCardTypes',
    function ($scope, $http, $modalInstance, ModelService,CreditCardTypes) {
        'use strict';
        $scope.tipopago = 0;
        var test = ModelService.create('Creditcardtype'); // create new instance of the model object
   //     test.insert(); 
       //Pruebas      
        $scope.search = function(){
            var filter = 'empl_name,lk,' + $scope.criteria.searchText + '*';          
            ModelService.get('Employee', { filter: filter })
                .then(function(employees){
                    $scope.employees = employees;
                });
        };
        //Efectivo Pesos
        $scope.ButtonEfectivo = function(){
         //   var filter = 'empl_name,lk,' + $scope.criteria.searchText + '*';          
                 $scope.Message = "EFECTIVO :D:D:D."
                 $scope.tipopago = 1;
        


        };
        //Cheque Personalizado Bes
        $scope.ButtonCheque = function(){       
                 $scope.Message = "Cheque :D:D:D."
                 $scope.tipopago = 2;

        };
        //Credito
        $scope.ButtonCredito = function(){       
                 $scope.Message = "Credito :D:D:D."
                 $scope.tipopago = 3;
        };   
        //Debito
        $scope.ButtonDebito = function(){       
                 $scope.Message = "Debito :D:D:D."
                 $scope.tipopago = 4;
        };
         
        $scope.Mostrar = function () {  
                $scope.muestra = 5;  
                $scope.photos=[];
                alert('HOLA!');
                $http.get("https://jsonplaceholder.typicode.com/posts")
                    .success(function(data){
                        console.log(data);
                        $scope.photos = data;
                })
                .error(function(err){
                
                    })
        };
       
      //  $scope.banco="";

    }

    
];


window.angular.module('prismPluginsSample.controller.employeeSearchSampleCtrl', [])
    .controller('employeeSearchSampleCtrl', employeeSearchSample);


    

    