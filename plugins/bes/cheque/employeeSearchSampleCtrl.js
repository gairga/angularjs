var employeeSearchSample = ['$scope', '$modalInstance', 'ModelService',
    function ($scope, $modalInstance, ModelService) {
        'use strict';
        $scope.criteria = {};

        $scope.search = function(){
            var filter = 'empl_name,lk,' + $scope.criteria.searchText + '*';
            // window.alert("hi!");
            ModelService.get('Employee', { filter: filter })
                .then(function(employees){
                    $scope.employees = employees;
                });
        };
    }
];


window.angular.module('prismPluginsSample.controller.employeeSearchSampleCtrl', [])
    .controller('employeeSearchSampleCtrl', employeeSearchSample);