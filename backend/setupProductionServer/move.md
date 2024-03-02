## Actions to move backend
1) Frontend Configurations
	
	1) Server URL and DNS
		
		Server URL in frontend/config.js has **not** been changed, because DNS servers is now pointing the IP address of the new server.. 
		
	2) Follow the instructions in setupProductionServer/readme.txt        
	   
		Until the instruction ```python manage.py loaddata enums.json```
		 
		Do not run it, instead all the db will be loaded manually.
		
	3) Save and Load
	
	Source Host
	```
	python manage.py dumpdata --natural-foreign --natural-primary -e contenttypes -e auth.Permission --indent 2 > dump.json
	```
	Destination Host
	```
	python manage.py migrate
	python manage.py loaddata "path/to/fixture/file" 
	```