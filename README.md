# pcl README

it's a simple syntaxes extension for the Patran PCL lanugue. 2020101

Internal use. If you have any suggestions, please contact my email mfc6027@163.com

## screenshot

![screenshot](https://www.smallgrass.net/complate.gif)

used the dark(default) theme
### 20210205:
	-- have add all the system API
	-- have finish all the functions
### 20210131:
	-- Add the code completion of system function, and the function source is Patran_ 2012_ customization.pdf
	-- The code completion of variables defined in the document is added
	problem:
	-- At present, there are still many problems, including:
	-- The variable is defined globally and cannot be accurate to class or function
	-- The switching document does not update the completion information
	-- New classes or functions defined are not recognized
	-- And so on

### 20210121(0.0.5)£º
		- The mutual reference of files in workspace is added. Provides automatic code completion for class and function calls.
		- The reference of function parameters is provided
	problem£º
		- The unrecognized problem caused by global function definition was not solved
		- The function call cross multiline is currently unrecognized
  		- Class, function, function arguments do not have enough documentation information
        - The system function does not contain

